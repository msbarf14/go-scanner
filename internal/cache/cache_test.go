package cache

import (
	"testing"
	"time"
)

func TestCacheMaxEntriesEvictsOldest(t *testing.T) {
	c := NewWithMax(2)
	defer c.Close()

	c.Set("a", 1, time.Minute)
	c.Set("b", 2, time.Minute)
	c.Set("c", 3, time.Minute)

	if _, ok := c.Get("a"); ok {
		t.Fatal("oldest item should be evicted")
	}
	if value, ok := c.Get("b"); !ok || value.(int) != 2 {
		t.Fatal("expected b to remain")
	}
	if value, ok := c.Get("c"); !ok || value.(int) != 3 {
		t.Fatal("expected c to remain")
	}
}
