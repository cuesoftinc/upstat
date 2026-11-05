// Package store is object storage (system-design.md §5.1): GCS in cloud via
// ADC, any S3-compatible store (MinIO) for compose and self-host. Upstat
// keeps everything under one prefix, upstat/<env>/: compute/ (claim-check
// payloads of bus messages), config/ (snapshots), postmortems/.
package store

import (
	"bytes"
	"context"
	"errors"
	"io"
	"strings"
	"time"

	gcs "cloud.google.com/go/storage"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"google.golang.org/api/iterator"
)

// Config selects the backend: Driver "s3" for MinIO, anything else for GCS.
type Config struct {
	Driver    string
	Bucket    string
	Prefix    string
	Endpoint  string
	AccessKey string
	SecretKey string
	UseSSL    bool
	// Create makes the bucket when it is missing (compose, self-host:
	// common owns it). Read-only services leave it false.
	Create bool
}

type Object struct {
	Key     string
	Created time.Time
}

type Store interface {
	Bucket() string
	Prefix() string
	Put(ctx context.Context, key string, data []byte, contentType string) error
	Get(ctx context.Context, key string) ([]byte, error)
	Delete(ctx context.Context, key string) error
	List(ctx context.Context, prefix string) ([]Object, error)
}

// ErrMissing is returned by Get for an object that doesn't exist.
var ErrMissing = errors.New("object missing")

func Open(ctx context.Context, cfg Config) (Store, error) {
	if cfg.Driver == "s3" {
		client, err := minio.New(cfg.Endpoint, &minio.Options{
			Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
			Secure: cfg.UseSSL,
		})
		if err != nil {
			return nil, err
		}
		if cfg.Create {
			if exists, err := client.BucketExists(ctx, cfg.Bucket); err != nil {
				return nil, err
			} else if !exists {
				if err := client.MakeBucket(ctx, cfg.Bucket, minio.MakeBucketOptions{}); err != nil {
					return nil, err
				}
			}
		}
		return &s3Store{client: client, bucket: cfg.Bucket, prefix: cfg.Prefix}, nil
	}
	client, err := gcs.NewClient(ctx)
	if err != nil {
		return nil, err
	}
	return &gcsStore{bucket: client.Bucket(cfg.Bucket), name: cfg.Bucket, prefix: cfg.Prefix}, nil
}

// ConfigKey is where the snapshot of one config kind lives.
func ConfigKey(s Store, kind string) string { return s.Prefix() + "/config/" + kind + ".json" }

// ComputePrefix holds claim-check payloads of bus messages.
func ComputePrefix(s Store) string { return s.Prefix() + "/compute/" }

// ── GCS ─────────────────────────────────────────────────────────────────

type gcsStore struct {
	bucket *gcs.BucketHandle
	name   string
	prefix string
}

func (s *gcsStore) Bucket() string { return s.name }
func (s *gcsStore) Prefix() string { return s.prefix }

func (s *gcsStore) Put(ctx context.Context, key string, data []byte, contentType string) error {
	w := s.bucket.Object(key).NewWriter(ctx)
	w.ContentType = contentType
	if _, err := w.Write(data); err != nil {
		_ = w.Close()
		return err
	}
	return w.Close()
}

func (s *gcsStore) Get(ctx context.Context, key string) ([]byte, error) {
	r, err := s.bucket.Object(key).NewReader(ctx)
	if errors.Is(err, gcs.ErrObjectNotExist) {
		return nil, ErrMissing
	}
	if err != nil {
		return nil, err
	}
	defer r.Close()
	return io.ReadAll(r)
}

func (s *gcsStore) Delete(ctx context.Context, key string) error {
	err := s.bucket.Object(key).Delete(ctx)
	if errors.Is(err, gcs.ErrObjectNotExist) {
		return nil
	}
	return err
}

func (s *gcsStore) List(ctx context.Context, prefix string) ([]Object, error) {
	var out []Object
	it := s.bucket.Objects(ctx, &gcs.Query{Prefix: prefix})
	for {
		attrs, err := it.Next()
		if errors.Is(err, iterator.Done) {
			return out, nil
		}
		if err != nil {
			return nil, err
		}
		out = append(out, Object{Key: attrs.Name, Created: attrs.Created})
	}
}

// ── S3 / MinIO ──────────────────────────────────────────────────────────

type s3Store struct {
	client *minio.Client
	bucket string
	prefix string
}

func (s *s3Store) Bucket() string { return s.bucket }
func (s *s3Store) Prefix() string { return s.prefix }

func (s *s3Store) Put(ctx context.Context, key string, data []byte, contentType string) error {
	_, err := s.client.PutObject(ctx, s.bucket, key, bytes.NewReader(data), int64(len(data)), minio.PutObjectOptions{ContentType: contentType})
	return err
}

func (s *s3Store) Get(ctx context.Context, key string) ([]byte, error) {
	obj, err := s.client.GetObject(ctx, s.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, err
	}
	defer obj.Close()
	data, err := io.ReadAll(obj)
	if minio.ToErrorResponse(err).Code == "NoSuchKey" {
		return nil, ErrMissing
	}
	return data, err
}

func (s *s3Store) Delete(ctx context.Context, key string) error {
	return s.client.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{})
}

func (s *s3Store) List(ctx context.Context, prefix string) ([]Object, error) {
	var out []Object
	for obj := range s.client.ListObjects(ctx, s.bucket, minio.ListObjectsOptions{Prefix: prefix, Recursive: true}) {
		if obj.Err != nil {
			return nil, obj.Err
		}
		if !strings.HasSuffix(obj.Key, "/") {
			out = append(out, Object{Key: obj.Key, Created: obj.LastModified})
		}
	}
	return out, nil
}

// Memory is an in-process Store for tests.
type Memory struct {
	Name, Pfx string
	Objects   map[string][]byte
}

func NewMemory(prefix string) *Memory {
	return &Memory{Name: "test", Pfx: prefix, Objects: map[string][]byte{}}
}

func (m *Memory) Bucket() string { return m.Name }
func (m *Memory) Prefix() string { return m.Pfx }

func (m *Memory) Put(_ context.Context, key string, data []byte, _ string) error {
	m.Objects[key] = append([]byte(nil), data...)
	return nil
}

func (m *Memory) Get(_ context.Context, key string) ([]byte, error) {
	data, ok := m.Objects[key]
	if !ok {
		return nil, ErrMissing
	}
	return data, nil
}

func (m *Memory) Delete(_ context.Context, key string) error {
	delete(m.Objects, key)
	return nil
}

func (m *Memory) List(_ context.Context, prefix string) ([]Object, error) {
	var out []Object
	for k := range m.Objects {
		if strings.HasPrefix(k, prefix) {
			out = append(out, Object{Key: k})
		}
	}
	return out, nil
}
