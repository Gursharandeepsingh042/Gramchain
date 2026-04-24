import * as SQLite from 'expo-sqlite'

const db = SQLite.openDatabaseSync('gramchain_offline.db')

export interface QueuedAction {
  id: string
  type: string
  payload: string // JSON
  createdAt: number
  retries: number
}

// Initialize tables
db.execSync(`
  CREATE TABLE IF NOT EXISTS offline_queue (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    retries INTEGER NOT NULL DEFAULT 0
  );
`)

export const enqueueAction = (type: string, payload: any) => {
  const id = Date.now().toString() + Math.random().toString()
  db.runSync(
    'INSERT INTO offline_queue (id, type, payload, created_at, retries) VALUES (?, ?, ?, ?, ?)',
    [id, type, JSON.stringify(payload), Date.now(), 0]
  )
}

export const getPendingActions = (): QueuedAction[] => {
  return db.getAllSync('SELECT * FROM offline_queue ORDER BY created_at ASC') as QueuedAction[]
}

export const removeAction = (id: string) => {
  db.runSync('DELETE FROM offline_queue WHERE id = ?', [id])
}

export const incrementActionRetry = (id: string) => {
  db.runSync('UPDATE offline_queue SET retries = retries + 1 WHERE id = ?', [id])
}
