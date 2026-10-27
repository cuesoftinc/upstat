package cache

import (
	"context"
	"fmt"
	"time"
)

type SSOStartLimits struct {
	RateWindow    time.Duration
	StateTTL      time.Duration
	SourceRate    int
	GlobalRate    int
	SourcePending int
	GlobalPending int
}

func (l SSOStartLimits) validate() error {
	if l.RateWindow <= 0 || l.StateTTL <= 0 || l.SourceRate <= 0 ||
		l.GlobalRate <= 0 || l.SourcePending <= 0 || l.GlobalPending <= 0 {
		return fmt.Errorf("cache: invalid SSO start limits")
	}
	return nil
}

type ssoReservation struct {
	id        string
	expiresAt time.Time
}

type sourceSSOReservations struct {
	rateExpires []time.Time
	pending     []ssoReservation
}

type memorySSOLimiter struct {
	sources       map[string]*sourceSSOReservations
	globalRate    []ssoReservation
	globalPending []ssoReservation
}

func (l *memorySSOLimiter) allow(source, reservationID string, now time.Time, limits SSOStartLimits) bool {
	l.prune(now)
	sourceReservations := l.sources[source]
	if sourceReservations == nil {
		sourceReservations = &sourceSSOReservations{}
		l.sources[source] = sourceReservations
	}

	sourceLimited := len(sourceReservations.rateExpires) >= limits.SourceRate ||
		len(sourceReservations.pending) >= limits.SourcePending
	if sourceLimited || len(l.globalRate) >= limits.GlobalRate ||
		len(l.globalPending) >= limits.GlobalPending {
		if len(sourceReservations.rateExpires) == 0 && len(sourceReservations.pending) == 0 {
			delete(l.sources, source)
		}
		return false
	}

	rateExpiry := now.Add(limits.RateWindow)
	pendingExpiry := now.Add(limits.StateTTL)
	sourceReservations.rateExpires = append(sourceReservations.rateExpires, rateExpiry)
	sourceReservations.pending = append(sourceReservations.pending, ssoReservation{id: reservationID, expiresAt: pendingExpiry})
	l.globalRate = append(l.globalRate, ssoReservation{expiresAt: rateExpiry})
	l.globalPending = append(l.globalPending, ssoReservation{id: reservationID, expiresAt: pendingExpiry})
	return true
}

func (l *memorySSOLimiter) release(source, reservationID string) {
	if sourceReservations := l.sources[source]; sourceReservations != nil {
		sourceReservations.pending = removeSSOReservation(sourceReservations.pending, reservationID)
		if len(sourceReservations.rateExpires) == 0 && len(sourceReservations.pending) == 0 {
			delete(l.sources, source)
		}
	}
	l.globalPending = removeSSOReservation(l.globalPending, reservationID)
}

func (l *memorySSOLimiter) prune(now time.Time) {
	if l.sources == nil {
		l.sources = make(map[string]*sourceSSOReservations)
	}
	l.globalRate = pruneSSOReservations(l.globalRate, now)
	l.globalPending = pruneSSOReservations(l.globalPending, now)
	for source, reservations := range l.sources {
		reservations.rateExpires = pruneTimes(reservations.rateExpires, now)
		reservations.pending = pruneSSOReservations(reservations.pending, now)
		if len(reservations.rateExpires) == 0 && len(reservations.pending) == 0 {
			delete(l.sources, source)
		}
	}
}

func pruneSSOReservations(reservations []ssoReservation, now time.Time) []ssoReservation {
	firstLive := 0
	for firstLive < len(reservations) && !reservations[firstLive].expiresAt.After(now) {
		firstLive++
	}
	return reservations[firstLive:]
}

func removeSSOReservation(reservations []ssoReservation, id string) []ssoReservation {
	for i := range reservations {
		if reservations[i].id == id {
			return append(reservations[:i], reservations[i+1:]...)
		}
	}
	return reservations
}

func pruneTimes(times []time.Time, now time.Time) []time.Time {
	firstLive := 0
	for firstLive < len(times) && !times[firstLive].After(now) {
		firstLive++
	}
	return times[firstLive:]
}

// AllowSSOStart reserves rate and pending-state capacity; unattributed sources share one bucket.
func (m *MemoryStore) AllowSSOStart(
	ctx context.Context,
	sourceHash string,
	reservationID string,
	now time.Time,
	limits SSOStartLimits,
) (bool, error) {
	if err := limits.validate(); err != nil {
		return false, err
	}
	if err := ctx.Err(); err != nil {
		return false, err
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	return m.ssoLimiter.allow(sourceBucket(sourceHash), reservationID, now, limits), nil
}

// ReleaseSSOStart frees pending-state capacity without resetting the rate window.
func (m *MemoryStore) ReleaseSSOStart(ctx context.Context, sourceHash, reservationID string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ssoLimiter.release(sourceBucket(sourceHash), reservationID)
	return nil
}
