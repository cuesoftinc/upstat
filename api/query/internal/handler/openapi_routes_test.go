package handler

import (
	"bytes"
	"go/ast"
	"go/parser"
	"go/printer"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"

	"go.yaml.in/yaml/v3"
)

const (
	specFile         = "../../../../docs/api/openapi.yaml"
	queryModuleRoot  = "../.."
	commonModuleRoot = "../../../common"
	nestSourceRoot   = "../../../observability/src"
	jobsSourceFile   = "../../../common/internal/jobs/handler.go"
)

var httpMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"}

type openAPIDoc struct {
	Paths      map[string]map[string]any `yaml:"paths"`
	Components struct {
		Schemas         map[string]any `yaml:"schemas"`
		Parameters      map[string]any `yaml:"parameters"`
		Responses       map[string]any `yaml:"responses"`
		RequestBodies   map[string]any `yaml:"requestBodies"`
		Headers         map[string]any `yaml:"headers"`
		SecuritySchemes map[string]any `yaml:"securitySchemes"`
	} `yaml:"components"`
}

func TestOpenAPICoversAllRegisteredRoutes(t *testing.T) {
	effectivePatterns := map[string]string{"jobs.Path": jobRoutePattern(t)}
	routes := map[string]bool{}
	for _, file := range goRouteFiles(t) {
		collectRoutes(t, file, effectivePatterns, routes)
	}
	for _, file := range nestControllerFiles(t) {
		collectNestRoutes(t, file, routes)
	}

	data, err := os.ReadFile(specFile)
	if err != nil {
		t.Fatal(err)
	}
	var doc openAPIDoc
	var root any
	if err := yaml.Unmarshal(data, &doc); err != nil {
		t.Fatal(err)
	}
	if err := yaml.Unmarshal(data, &root); err != nil {
		t.Fatal(err)
	}
	methods := map[string]bool{}
	for _, method := range httpMethods {
		methods[method] = true
	}
	spec := map[string]bool{}
	for path, item := range doc.Paths {
		for method := range item {
			if methods[strings.ToUpper(method)] {
				spec[strings.ToUpper(method)+" "+path] = true
			}
		}
	}

	components := map[string]map[string]any{
		"schemas":         doc.Components.Schemas,
		"parameters":      doc.Components.Parameters,
		"responses":       doc.Components.Responses,
		"requestBodies":   doc.Components.RequestBodies,
		"headers":         doc.Components.Headers,
		"securitySchemes": doc.Components.SecuritySchemes,
	}
	refs := map[string]bool{}
	securityNames := map[string]bool{}
	collectReferences(root, refs, securityNames)

	var missing, undocumented, badRefs, badSecurity []string
	for route := range routes {
		if !spec[route] {
			missing = append(missing, route)
		}
	}
	for route := range spec {
		if !routes[route] {
			undocumented = append(undocumented, route)
		}
	}
	componentRef := regexp.MustCompile(`^#/components/([A-Za-z]+)/([A-Za-z0-9._-]+)$`)
	for ref := range refs {
		match := componentRef.FindStringSubmatch(ref)
		if match == nil {
			continue
		}
		values, ok := components[match[1]]
		if !ok {
			badRefs = append(badRefs, ref)
			continue
		}
		if _, ok := values[match[2]]; !ok {
			badRefs = append(badRefs, ref)
		}
	}
	for name := range securityNames {
		if _, ok := doc.Components.SecuritySchemes[name]; !ok {
			badSecurity = append(badSecurity, name)
		}
	}
	sort.Strings(missing)
	sort.Strings(undocumented)
	sort.Strings(badRefs)
	sort.Strings(badSecurity)
	if len(missing) > 0 {
		t.Errorf("routes missing from the OpenAPI spec:\n%s", strings.Join(missing, "\n"))
	}
	if len(undocumented) > 0 {
		t.Errorf("spec paths with no registered route:\n%s", strings.Join(undocumented, "\n"))
	}
	if len(badRefs) > 0 {
		t.Errorf("OpenAPI references undefined components:\n%s", strings.Join(badRefs, "\n"))
	}
	if len(badSecurity) > 0 {
		t.Errorf("OpenAPI security requirements reference undefined schemes:\n%s", strings.Join(badSecurity, "\n"))
	}
}

func collectReferences(value any, refs, securityNames map[string]bool) {
	switch v := value.(type) {
	case map[string]any:
		for key, item := range v {
			if key == "$ref" {
				if ref, ok := item.(string); ok {
					refs[ref] = true
				}
			}
			if key == "security" {
				for _, requirement := range toSlice(item) {
					if names, ok := requirement.(map[string]any); ok {
						for name := range names {
							securityNames[name] = true
						}
					}
				}
			}
			collectReferences(item, refs, securityNames)
		}
	case []any:
		for _, item := range v {
			collectReferences(item, refs, securityNames)
		}
	}
}

func toSlice(value any) []any {
	if list, ok := value.([]any); ok {
		return list
	}
	return nil
}

func jobRoutePattern(t *testing.T) string {
	t.Helper()
	data, err := os.ReadFile(jobsSourceFile)
	if err != nil {
		t.Fatal(err)
	}
	path := regexp.MustCompile(`\bPath\s*=\s*"([^"]*)"`).FindSubmatch(data)
	if path == nil {
		t.Fatalf("cannot resolve jobs.Path in %s", jobsSourceFile)
	}
	method := regexp.MustCompile(`r\.Method\s*!=\s*http\.Method([A-Za-z]+)`).FindSubmatch(data)
	if method == nil {
		t.Fatalf("cannot resolve jobs method in %s", jobsSourceFile)
	}
	return strings.ToUpper(string(method[1])) + " " + strings.TrimSuffix(string(path[1]), "/") + "/{name}"
}

func goRouteFiles(t *testing.T) []string {
	t.Helper()
	roots := []string{queryModuleRoot, commonModuleRoot}
	seen := map[string]bool{}
	for _, root := range roots {
		rootCount := 0
		err := filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if !entry.IsDir() && strings.HasSuffix(path, ".go") && !strings.HasSuffix(path, "_test.go") {
				seen[path] = true
				rootCount++
			}
			return nil
		})
		if err != nil {
			t.Fatal(err)
		}
		if rootCount == 0 {
			t.Fatalf("no Go source files discovered under %s; check discovery roots", root)
		}
	}
	files := make([]string, 0, len(seen))
	for file := range seen {
		files = append(files, file)
	}
	sort.Strings(files)
	return files
}

func nestControllerFiles(t *testing.T) []string {
	t.Helper()
	var files []string
	controller := regexp.MustCompile(`@Controller\s*\(`)
	err := filepath.WalkDir(nestSourceRoot, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || !strings.HasSuffix(path, ".ts") || isNestNonSource(path) {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		if controller.Match(stripTSComments(data)) {
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(files) == 0 {
		t.Fatal("no Nest controllers found")
	}
	sort.Strings(files)
	return files
}

func collectRoutes(t *testing.T, file string, effectivePatterns map[string]string, routes map[string]bool) {
	t.Helper()
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, file, nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	hasRegister := false
	for _, decl := range node.Decls {
		if fn, ok := decl.(*ast.FuncDecl); ok && fn.Name.Name == "Register" {
			hasRegister = true
		}
	}
	skip := map[*ast.FuncLit]bool{}
	for _, decl := range node.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok || fn.Body == nil {
			continue
		}
		ast.Inspect(fn.Body, func(n ast.Node) bool {
			switch v := n.(type) {
			case *ast.FuncLit:
				if skip[v] {
					return false
				}
			case *ast.AssignStmt:
				if len(v.Rhs) == 1 {
					markHelperLiterals(skip, v.Lhs, v.Rhs)
				}
			case *ast.ValueSpec:
				for i, name := range v.Names {
					if (name.Name == "get" || name.Name == "write") && i < len(v.Values) {
						if lit, ok := v.Values[i].(*ast.FuncLit); ok {
							skip[lit] = true
						}
					}
				}
			}
			call, ok := n.(*ast.CallExpr)
			if !ok || len(call.Args) == 0 {
				return true
			}
			callee := calleeName(call.Fun)
			if isHandleCallee(callee) {
				pattern, ok := constString(call.Args[0], effectivePatterns)
				if !ok {
					t.Errorf("cannot resolve route pattern in %s: %s", file, exprString(call.Args[0]))
					return true
				}
				if isRoutePattern(pattern) {
					addRoute(t, routes, pattern)
				} else if strings.HasPrefix(strings.TrimSpace(pattern), "/") {
					for _, method := range httpMethods {
						addRoute(t, routes, method+" "+strings.TrimSpace(pattern))
					}
				}
				return true
			}
			if !hasRegister {
				return true
			}
			switch callee {
			case "get":
				pattern, ok := constString(call.Args[0], effectivePatterns)
				if !ok {
					t.Errorf("cannot resolve route pattern in %s: %s", file, exprString(call.Args[0]))
					return true
				}
				addMethodRoute(t, routes, "GET", pattern)
			case "write":
				if len(call.Args) < 2 {
					return true
				}
				method, okMethod := constString(call.Args[0], effectivePatterns)
				pattern, okPattern := constString(call.Args[1], effectivePatterns)
				if !okMethod || !okPattern {
					t.Errorf("cannot resolve route registration in %s: %s", file, exprString(call))
					return true
				}
				addMethodRoute(t, routes, method, pattern)
			}
			return true
		})
	}
}

func markHelperLiterals(skip map[*ast.FuncLit]bool, lhs, rhs []ast.Expr) {
	if len(rhs) != 1 {
		return
	}
	lit, ok := rhs[0].(*ast.FuncLit)
	if !ok {
		return
	}
	for _, item := range lhs {
		if id, ok := item.(*ast.Ident); ok && (id.Name == "get" || id.Name == "write") {
			skip[lit] = true
		}
	}
}

func isHandleCallee(name string) bool {
	return name == "Handle" || name == "HandleFunc" || strings.HasSuffix(name, ".Handle") || strings.HasSuffix(name, ".HandleFunc")
}

func calleeName(e ast.Expr) string {
	switch v := e.(type) {
	case *ast.Ident:
		return v.Name
	case *ast.SelectorExpr:
		if x, ok := v.X.(*ast.Ident); ok {
			return x.Name + "." + v.Sel.Name
		}
	}
	return ""
}

func constString(e ast.Expr, effectivePatterns map[string]string) (string, bool) {
	switch v := e.(type) {
	case *ast.BasicLit:
		if v.Kind != token.STRING {
			return "", false
		}
		s, err := strconv.Unquote(v.Value)
		return s, err == nil
	case *ast.BinaryExpr:
		if v.Op != token.ADD {
			return "", false
		}
		left, okLeft := constString(v.X, effectivePatterns)
		right, okRight := constString(v.Y, effectivePatterns)
		return left + right, okLeft && okRight
	case *ast.Ident:
		if pattern, found := effectivePatterns[v.Name]; found {
			return pattern, true
		}
	case *ast.SelectorExpr:
		if x, ok := v.X.(*ast.Ident); ok {
			if pattern, found := effectivePatterns[x.Name+"."+v.Sel.Name]; found {
				return pattern, true
			}
		}
	}
	return "", false
}

func exprString(e ast.Expr) string {
	var buf bytes.Buffer
	if err := printer.Fprint(&buf, token.NewFileSet(), e); err != nil {
		return "unprintable expression"
	}
	return buf.String()
}

func collectNestRoutes(t *testing.T, file string, routes map[string]bool) {
	t.Helper()
	data, err := os.ReadFile(file)
	if err != nil {
		t.Fatal(err)
	}
	data = stripTSComments(data)
	controllers := regexp.MustCompile(`(?s)@Controller\s*\(([^)]*)\)`).FindAllSubmatchIndex(data, -1)
	if len(controllers) == 0 {
		t.Fatalf("no @Controller decorator in %s", file)
	}
	decorators := regexp.MustCompile(`(?s)@(Get|Post|Put|Patch|Delete|Options|Head|All)(?:\s*\(([^)]*)\))?`)
	for i, controller := range controllers {
		prefix := nestPathArg(t, file, string(data[controller[2]:controller[3]]), "@Controller")
		end := len(data)
		if i+1 < len(controllers) {
			end = controllers[i+1][0]
		}
		for _, match := range decorators.FindAllSubmatch(data[controller[1]:end], -1) {
			name := string(match[1])
			path := nestPathArg(t, file, string(match[2]), "@"+name)
			names := []string{strings.ToUpper(name)}
			if strings.EqualFold(name, "All") {
				names = httpMethods
			}
			for _, method := range names {
				routes[method+" "+joinNestPath(prefix, path)] = true
			}
		}
	}
}

func isNestNonSource(path string) bool {
	return strings.HasSuffix(path, ".d.ts") || strings.HasSuffix(path, ".spec.ts") || strings.HasSuffix(path, ".test.ts")
}

func stripTSComments(data []byte) []byte {
	out := make([]byte, 0, len(data))
	line, block := false, false
	var quote byte
	escaped := false
	for i := 0; i < len(data); i++ {
		c := data[i]
		if line {
			if c == '\n' {
				line = false
				out = append(out, c)
			}
			continue
		}
		if block {
			if c == '*' && i+1 < len(data) && data[i+1] == '/' {
				block = false
				i++
			}
			continue
		}
		if quote != 0 {
			out = append(out, c)
			if escaped {
				escaped = false
			} else if c == '\\' {
				escaped = true
			} else if c == quote {
				quote = 0
			}
			continue
		}
		if c == '/' && i+1 < len(data) {
			switch data[i+1] {
			case '/':
				line = true
				i++
				continue
			case '*':
				block = true
				i++
				continue
			}
		}
		if c == '"' || c == '\'' || c == '`' {
			quote = c
		}
		out = append(out, c)
	}
	return out
}

func nestPathArg(t *testing.T, file, arg, decorator string) string {
	t.Helper()
	arg = strings.TrimSpace(arg)
	if arg == "" {
		return ""
	}
	if isTSQuote(arg[0]) {
		for i := 1; i < len(arg); i++ {
			if arg[i] == '\\' {
				i++
				continue
			}
			if arg[i] == arg[0] {
				return arg[1:i]
			}
		}
	} else if comma := strings.Index(arg, ","); comma >= 0 {
		arg = strings.TrimSpace(arg[:comma])
	}
	t.Errorf("cannot resolve %s path in %s: %s", decorator, file, arg)
	return ""
}

func isTSQuote(c byte) bool {
	return c == '"' || c == '\'' || c == '`'
}

func joinNestPath(prefix, path string) string {
	return "/" + strings.Trim(strings.TrimSpace(prefix)+"/"+strings.TrimSpace(path), "/")
}

func isRoutePattern(pattern string) bool {
	parts := strings.Fields(strings.TrimSpace(pattern))
	return len(parts) >= 2 && isHTTPMethod(parts[0]) && strings.HasPrefix(parts[1], "/")
}

func isHTTPMethod(method string) bool {
	for _, candidate := range httpMethods {
		if strings.EqualFold(method, candidate) {
			return true
		}
	}
	return false
}

func addMethodRoute(t *testing.T, routes map[string]bool, method, pattern string) {
	t.Helper()
	pattern = strings.TrimSpace(pattern)
	if !isRoutePattern(pattern) {
		pattern = strings.ToUpper(method) + " " + pattern
	}
	addRoute(t, routes, pattern)
}

func addRoute(t *testing.T, routes map[string]bool, pattern string) {
	t.Helper()
	if !isRoutePattern(pattern) {
		t.Fatalf("route pattern %q has no method and path", pattern)
	}
	parts := strings.Fields(strings.TrimSpace(pattern))
	routes[strings.ToUpper(parts[0])+" "+strings.Join(parts[1:], " ")] = true
}
