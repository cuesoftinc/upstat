package bus

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"strings"
	"testing"
	"time"

	kgo "github.com/segmentio/kafka-go"
)

// TestCaughtUp runs against a real broker (KAFKA_TEST_BROKERS, e.g. the
// compose broker's localhost:9094) on a topic of its own.
func TestCaughtUp(t *testing.T) {
	brokers := os.Getenv("KAFKA_TEST_BROKERS")
	if brokers == "" {
		t.Skip("KAFKA_TEST_BROKERS not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	addrs := strings.Split(brokers, ",")
	topic := fmt.Sprintf("upstat.test.caughtup.%d", rand.Int63())
	admin := &kgo.Client{Addr: kgo.TCP(addrs...), Timeout: 10 * time.Second}
	if _, err := admin.CreateTopics(ctx, &kgo.CreateTopicsRequest{Topics: []kgo.TopicConfig{{Topic: topic, NumPartitions: 2, ReplicationFactor: 1}}}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = admin.DeleteTopics(context.Background(), &kgo.DeleteTopicsRequest{Topics: []string{topic}})
	})

	c, err := NewConsumer(Config{Brokers: addrs}, "upstat-test-caughtup", topic, map[string]Handler{}, nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	waitFor(t, ctx, c, true) // empty topic: nothing to handle

	w := &kgo.Writer{Addr: kgo.TCP(addrs...), Topic: topic, Balancer: &kgo.RoundRobin{}, AllowAutoTopicCreation: false}
	defer w.Close()
	if err := w.WriteMessages(ctx, kgo.Message{Value: []byte(`{}`)}, kgo.Message{Value: []byte(`{}`)}, kgo.Message{Value: []byte(`{}`)}); err != nil {
		t.Fatal(err)
	}
	if ok, err := c.CaughtUp(ctx); err != nil || ok {
		t.Fatalf("CaughtUp with three unhandled messages = %v, %v; want false", ok, err)
	}

	run, stop := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() { _ = c.Run(run); close(done) }()
	if err := c.WaitCaughtUp(ctx, 30*time.Second); err != nil {
		t.Fatal(err)
	}
	stop()
	<-done
}

func waitFor(t *testing.T, ctx context.Context, c *Consumer, want bool) {
	t.Helper()
	deadline := time.Now().Add(20 * time.Second)
	for {
		ok, err := c.CaughtUp(ctx)
		if err == nil && ok == want {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("CaughtUp = %v, %v; want %v", ok, err, want)
		}
		time.Sleep(250 * time.Millisecond)
	}
}
