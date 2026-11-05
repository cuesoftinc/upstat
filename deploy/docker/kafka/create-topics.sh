#!/bin/sh
# Creates the shared bus lanes Upstat uses (decisions.md X-11) on the compose
# broker. In cloud the lanes live on the shared Kafka service, and Upstat
# never creates its own. Idempotent.
set -eu
BOOTSTRAP="$1"
TOPICS=/opt/kafka/bin/kafka-topics.sh
DAY_MS=86400000

# Two partitions each, as on the shared service; 24 h retention.
for topic in cuelabs.uploads cuelabs.requests cuelabs.results; do
  "$TOPICS" --bootstrap-server "$BOOTSTRAP" --create --if-not-exists --topic "$topic" \
    --partitions 2 --replication-factor 1 --config retention.ms=$DAY_MS
done

"$TOPICS" --bootstrap-server "$BOOTSTRAP" --list | grep '^cuelabs\.'
