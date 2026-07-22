package cache

import (
	"sync"
	"time"
)

type Cache struct {
	mu         sync.RWMutex
	items      map[string]item
	stop       chan struct{}
	maxEntries int
}

type item struct {
	value     interface{}
	expiresAt time.Time
}

func New() *Cache {
	return NewWithMax(0)
}

func NewWithMax(maxEntries int) *Cache {
	c := &Cache{
		items:      make(map[string]item),
		stop:       make(chan struct{}),
		maxEntries: maxEntries,
	}
	go c.cleanup()
	return c
}

func (c *Cache) Set(key string, value interface{}, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	if c.maxEntries > 0 {
		if _, exists := c.items[key]; !exists && len(c.items) >= c.maxEntries {
			c.cleanupExpiredLocked(now)
			if len(c.items) >= c.maxEntries {
				c.deleteEarliestLocked()
			}
		}
	}

	c.items[key] = item{
		value:     value,
		expiresAt: now.Add(ttl),
	}
}

func (c *Cache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	item, found := c.items[key]
	if !found {
		return nil, false
	}
	if time.Now().After(item.expiresAt) {
		return nil, false
	}
	return item.value, true
}

func (c *Cache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.items, key)
}

func (c *Cache) cleanup() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			c.mu.Lock()
			c.cleanupExpiredLocked(time.Now())
			c.mu.Unlock()
		case <-c.stop:
			return
		}
	}
}

func (c *Cache) cleanupExpiredLocked(now time.Time) {
	for k, v := range c.items {
		if now.After(v.expiresAt) {
			delete(c.items, k)
		}
	}
}

func (c *Cache) deleteEarliestLocked() {
	oldestKey := ""
	var oldest time.Time
	for key, item := range c.items {
		if oldestKey == "" || item.expiresAt.Before(oldest) {
			oldestKey = key
			oldest = item.expiresAt
		}
	}
	if oldestKey != "" {
		delete(c.items, oldestKey)
	}
}

func (c *Cache) Close() {
	close(c.stop)
}
