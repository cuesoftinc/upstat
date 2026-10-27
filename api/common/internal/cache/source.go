package cache

// UnattributedSourceHash is the shared bucket for requests whose source IP cannot be attributed.
const UnattributedSourceHash = "unattributed"

func sourceBucket(sourceHash string) string {
	if sourceHash == "" {
		return UnattributedSourceHash
	}
	return sourceHash
}
