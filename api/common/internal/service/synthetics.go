package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
)

// Synthetics beyond HTTP (pages.md B7, OBS-011): multi-step API checks
// run by the probe; browser checks are stored and listed, and run as a
// failing step until the probe gains a browser (recorded in decisions.md).

type StepInput struct {
	Kind       string `json:"kind"`
	Method     string `json:"method"`
	URL        string `json:"url"`
	Expression string `json:"expression"`
	WaitMs     *int   `json:"wait_ms"`
}

type SyntheticInput struct {
	Name            *string              `json:"name"`
	Kind            *string              `json:"kind"`
	Steps           *[]StepInput         `json:"steps"`
	Browser         *model.BrowserConfig `json:"browser"`
	IntervalSeconds *int                 `json:"interval_seconds"`
}

var assertionRe = regexp.MustCompile(`^(status|body|header\.[A-Za-z0-9-]+|duration_ms)\s*(==|!=|<=|>=|<|>|contains)\s*.+$`)
var viewports = map[string]bool{"1440x900": true, "768x1024": true, "390x844": true}

func (s *Services) buildSteps(in []StepInput) ([]model.SyntheticStep, error) {
	steps := make([]model.SyntheticStep, 0, len(in))
	if len(in) > 20 {
		return nil, invalid("bad_shape", "a check has at most 20 steps")
	}
	for i, st := range in {
		step := model.SyntheticStep{ID: uuid.NewString(), Kind: st.Kind}
		switch st.Kind {
		case "http":
			if st.Method != "GET" && st.Method != "POST" && st.Method != "HEAD" {
				return nil, invalid("bad_shape", fmt.Sprintf("step %d: method must be GET, POST or HEAD", i+1))
			}
			if err := s.validateTarget(st.URL); err != nil {
				return nil, err
			}
			step.Method, step.URL, step.Summary = st.Method, st.URL, st.Method+" "+st.URL
		case "assertion":
			expr := strings.TrimSpace(st.Expression)
			if !assertionRe.MatchString(expr) {
				return nil, invalid("invalid_assertion", fmt.Sprintf("step %d: assertions look like status == 200", i+1))
			}
			step.Expression, step.Summary = expr, expr
		case "wait":
			if st.WaitMs == nil || *st.WaitMs < 0 || *st.WaitMs > 30000 {
				return nil, invalid("bad_shape", fmt.Sprintf("step %d: wait is 0-30000 ms", i+1))
			}
			step.WaitMs, step.Summary = st.WaitMs, fmt.Sprintf("wait %d ms", *st.WaitMs)
		default:
			return nil, invalid("bad_shape", fmt.Sprintf("step %d: kind must be http, assertion or wait", i+1))
		}
		steps = append(steps, step)
	}
	return steps, nil
}

func (s *Services) checkSynthetic(c *model.SyntheticCheck) error {
	c.Name = strings.TrimSpace(c.Name)
	if c.Name == "" || len(c.Name) > 80 {
		return invalid("bad_shape", "name is required")
	}
	if c.Kind != "multi_step" && c.Kind != "browser" {
		return invalid("bad_shape", "kind must be multi_step or browser")
	}
	if c.Kind == "multi_step" && len(c.Steps) == 0 {
		return invalid("bad_shape", "a multi-step check needs steps")
	}
	if c.Kind == "browser" && c.Browser == nil {
		return invalid("bad_shape", "a browser check needs its browser settings")
	}
	if c.Browser != nil {
		if err := s.validateTarget(c.Browser.URL); err != nil {
			return err
		}
		if !viewports[c.Browser.Viewport] {
			return invalid("bad_shape", "viewport must be 1440x900, 768x1024 or 390x844")
		}
	}
	if c.IntervalSeconds < 60 || c.IntervalSeconds > 86400 {
		return invalid("invalid_interval", "interval must be between 60 seconds and 24 hours")
	}
	return nil
}

func (s *Services) ListSynthetics(ctx context.Context, c *Caller) ([]model.SyntheticCheck, error) {
	var out []model.SyntheticCheck
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		out, err = repository.ListSynthetics(ctx, tx)
		return err
	})
	return out, err
}

func (s *Services) GetSynthetic(ctx context.Context, c *Caller, id string) (*model.SyntheticCheck, error) {
	var out *model.SyntheticCheck
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		out, err = repository.GetSynthetic(ctx, tx, id)
		return orNotFound(err, "check")
	})
	return out, err
}

func (s *Services) CreateSynthetic(ctx context.Context, c *Caller, in SyntheticInput) (*model.SyntheticCheck, error) {
	steps, err := s.buildSteps(deref(in.Steps, nil))
	if err != nil {
		return nil, err
	}
	check := model.SyntheticCheck{Name: deref(in.Name, ""), Kind: deref(in.Kind, ""), Steps: steps, Browser: in.Browser,
		IntervalSeconds: deref(in.IntervalSeconds, 300)}
	if err := s.checkSynthetic(&check); err != nil {
		return nil, err
	}
	var out *model.SyntheticCheck
	err = s.inOrg(ctx, c, "member", func(tx pgx.Tx) (err error) {
		out, err = repository.CreateSynthetic(ctx, tx, c.OrgID, check)
		if errors.Is(err, repository.ErrConflict) {
			return conflict("name_taken", "a check with this name exists")
		}
		return err
	})
	return out, err
}

func (s *Services) UpdateSynthetic(ctx context.Context, c *Caller, id string, in SyntheticInput) (*model.SyntheticCheck, error) {
	var out *model.SyntheticCheck
	err := s.inOrg(ctx, c, "member", func(tx pgx.Tx) error {
		cur, err := repository.GetSynthetic(ctx, tx, id)
		if err != nil {
			return orNotFound(err, "check")
		}
		cur.Name, cur.Kind = deref(in.Name, cur.Name), deref(in.Kind, cur.Kind)
		cur.IntervalSeconds = deref(in.IntervalSeconds, cur.IntervalSeconds)
		if in.Browser != nil {
			cur.Browser = in.Browser
		}
		if in.Steps != nil {
			if cur.Steps, err = s.buildSteps(*in.Steps); err != nil {
				return err
			}
		}
		if err := s.checkSynthetic(cur); err != nil {
			return err
		}
		out, err = repository.SaveSynthetic(ctx, tx, *cur)
		if errors.Is(err, repository.ErrConflict) {
			return conflict("name_taken", "a check with this name exists")
		}
		return err
	})
	return out, err
}

func (s *Services) DeleteSynthetic(ctx context.Context, c *Caller, id string) error {
	return s.inOrg(ctx, c, "member", func(tx pgx.Tx) error {
		return orNotFound(repository.DeleteSynthetic(ctx, tx, id), "check")
	})
}

func (s *Services) ListRuns(ctx context.Context, c *Caller, id string) ([]model.SyntheticRun, error) {
	var out []model.SyntheticRun
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) error {
		if _, err := repository.GetSynthetic(ctx, tx, id); err != nil {
			return orNotFound(err, "check")
		}
		var err error
		out, err = repository.ListRuns(ctx, tx, id, 50)
		return err
	})
	return out, err
}

func (s *Services) GetRun(ctx context.Context, c *Caller, id, runID string) (*model.SyntheticRun, error) {
	var out *model.SyntheticRun
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		out, err = repository.GetRun(ctx, tx, id, runID)
		return orNotFound(err, "run")
	})
	return out, err
}

// RunSyntheticNow runs a check once, now (the builder's "Run once").
func (s *Services) RunSyntheticNow(ctx context.Context, c *Caller, id string) (*model.SyntheticRun, error) {
	check, err := s.GetSynthetic(ctx, c, id)
	if err != nil {
		return nil, err
	}
	if err := c.can("member"); err != nil {
		return nil, err
	}
	check.OrgID = c.OrgID
	return s.runSynthetic(ctx, *check)
}

func (s *Services) runSynthetic(ctx context.Context, check model.SyntheticCheck) (*model.SyntheticRun, error) {
	regions := s.Config.Regions()
	if len(regions) == 0 {
		return nil, &Error{Status: 503, Code: "unavailable", Message: "no probe region is configured"}
	}
	started := s.Now().UTC()
	res, err := s.Prober.Run(ctx, regions[0], RunRequest{Steps: check.Steps, Browser: check.Browser, Kind: check.Kind})
	if err != nil {
		return nil, &Error{Status: 502, Code: "probe_unavailable", Message: "the probe did not answer; try again"}
	}
	run := model.SyntheticRun{CheckID: check.ID, Status: "pass", StartedAt: started, Steps: res.Steps, StepsTotal: len(check.Steps)}
	if check.Kind == "browser" && run.StepsTotal == 0 {
		run.StepsTotal = 1
	}
	for _, st := range res.Steps {
		run.TotalMs += st.DurationMs
		if st.Status == "fail" {
			run.Status = "fail"
		}
	}
	if run.Steps == nil {
		run.Steps = []model.SyntheticStepResult{}
	}
	if run.Status == "fail" && check.Browser != nil && check.Browser.ScreenshotOnFailure && res.ScreenshotStep > 0 {
		run.FailureScreenshot = &model.FailureScreenshot{StepIndex: res.ScreenshotStep, Viewport: check.Browser.Viewport}
	}
	var out *model.SyntheticRun
	err = s.DB.AsOrg(ctx, check.OrgID, func(tx pgx.Tx) (err error) {
		out, err = repository.InsertRun(ctx, tx, check.OrgID, run)
		return err
	})
	return out, err
}
