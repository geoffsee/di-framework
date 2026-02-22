import { expect, test } from 'bun:test';
import { useContainer } from '@di-framework/di-framework/container';

// Need to run the file to register the containers,
// but we just want the classes
import * as advanced from './index';

test('advanced example - NotificationService uses EmailService', () => {
  const container = useContainer();
  // Cast to any to bypass private visibility for testing
  const notificationService = container.resolve<any>(advanced.NotificationService);

  if (notificationService) {
    expect(notificationService.email).toBeDefined();
    expect(notificationService.email.send).toBeInstanceOf(Function);
  }
});

test('advanced example - runs successfully', () => {
  // We can just verify that it executes without throwing errors
  expect(() => {
    advanced.runAdvancedExamples();
  }).not.toThrow();
});
