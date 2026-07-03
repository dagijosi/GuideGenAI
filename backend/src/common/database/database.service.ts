import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import { ensureDir } from '../utils/file.utils';
import { dirname } from 'path';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private db!: Database.Database;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const dbPath = this.configService.get<string>('DB_PATH', './storage/guidegen.sqlite');
    ensureDir(dirname(dbPath));
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
    this.logger.log(`SQLite database connected: ${dbPath}`);
  }

  onModuleDestroy(): void {
    this.db?.close();
    this.logger.log('Database connection closed');
  }

  getDb(): Database.Database {
    return this.db;
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        credentials TEXT,
        status TEXT NOT NULL DEFAULT 'idle',
        progress INTEGER NOT NULL DEFAULT 0,
        storage_path TEXT NOT NULL,
        page_count INTEGER NOT NULL DEFAULT 0,
        workflow_count INTEGER NOT NULL DEFAULT 0,
        screenshot_count INTEGER NOT NULL DEFAULT 0,
        video_count INTEGER NOT NULL DEFAULT 0,
        max_depth INTEGER NOT NULL DEFAULT 3,
        max_pages INTEGER NOT NULL DEFAULT 50,
        include_screenshots INTEGER NOT NULL DEFAULT 1,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pages (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        metadata TEXT,
        screenshot_path TEXT,
        visited_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        steps TEXT NOT NULL,
        video_path TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS documentation (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        page_id TEXT,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        context TEXT,
        created_at TEXT NOT NULL
      );
    `);

    // Add new columns to existing tables safely — ALTER TABLE ignores errors if column exists
    this.addColumnIfMissing('projects', 'max_depth', 'INTEGER NOT NULL DEFAULT 3');
    this.addColumnIfMissing('projects', 'max_pages', 'INTEGER NOT NULL DEFAULT 50');
    this.addColumnIfMissing('projects', 'include_screenshots', 'INTEGER NOT NULL DEFAULT 1');

    this.logger.log('Database migrations applied');
  }

  /**
   * Adds a column to a table only if it doesn't already exist.
   * SQLite does not support IF NOT EXISTS on ALTER TABLE, so we catch the error.
   */
  private addColumnIfMissing(table: string, column: string, definition: string): void {
    try {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      this.logger.log(`Added column ${table}.${column}`);
    } catch {
      // Column already exists — safe to ignore
    }
  }
}
