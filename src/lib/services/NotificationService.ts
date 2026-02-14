import { ConfigService } from './ConfigService';

export interface INotificationService {
	sendWaitlistSignup(email: string): Promise<void>;
}

export class AppriseNotificationService implements INotificationService {
	private endpoint: string | undefined;

	constructor() {
		this.endpoint = ConfigService.get('NOTIFICATION_ENDPOINT');
	}

	async sendWaitlistSignup(email: string): Promise<void> {
		if (!this.endpoint) {
			console.warn('NOTIFICATION_ENDPOINT not configured, skipping notification');
			return;
		}

		try {
			const response = await fetch(this.endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					title: 'New Waitlist Signup',
					body: `A new user has joined the waitlist: ${email}`,
					type: 'info'
				})
			});

			if (!response.ok) {
				console.error(`Failed to send notification: ${response.status} ${response.statusText}`);
			} else {
				console.log(`Notification sent for waitlist signup: ${email}`);
			}
		} catch (error) {
			console.error('Error sending notification:', error);
			// Don't throw - notifications should be non-blocking
		}
	}
}

// Mock implementation for development/testing
export class MockNotificationService implements INotificationService {
	async sendWaitlistSignup(email: string): Promise<void> {
		console.log(`[MOCK] Waitlist signup notification: ${email}`);
	}
}
