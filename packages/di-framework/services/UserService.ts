/**
 * Example User Service
 *
 * Demonstrates constructor dependency injection
 */

import { Container } from '../decorators';
import { DatabaseService } from './DatabaseService';
import { LoggerService } from './LoggerService';

interface User {
  id: string;
  name: string;
  email: string;
}

@Container()
export class UserService {
  private users: Map<string, User> = new Map();

  constructor(
    private readonly db: DatabaseService,
    private readonly logger: LoggerService
  ) {
    console.log('[UserService] Created with dependencies');
  }

  createUser(id: string, name: string, email: string): User {
    const user: User = { id, name, email };
    this.users.set(id, user);
    this.logger.log(`User created: ${name} (${email})`);
    this.db.query(`INSERT INTO users VALUES ('${id}', '${name}', '${email}')`);
    return user;
  }

  getUser(id: string): User | undefined {
    const user = this.users.get(id);
    if (user) {
      this.logger.log(`User retrieved: ${user.name}`);
      this.db.query(`SELECT * FROM users WHERE id = '${id}'`);
    }
    return user;
  }

  listUsers(): User[] {
    const users = Array.from(this.users.values());
    this.logger.log(`Listed ${users.length} users`);
    this.db.query('SELECT * FROM users');
    return users;
  }
}
