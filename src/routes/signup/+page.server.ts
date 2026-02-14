import { fail, redirect, isRedirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { AppFactory } from '$lib/factories';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email({ message: "Invalid email address" })
});

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) {
    throw redirect(303, '/');
  }
};

export const actions: Actions = {
  default: async ({ request }) => {
    const formData = await request.formData();
    const email = formData.get('email');

    const result = schema.safeParse({ email });

    if (!result.success) {
      return fail(400, {
        email,
        errors: result.error.flatten().fieldErrors
      });
    }

    const waitlistRepo = AppFactory.getWaitlistRepository();
    const userRepo = AppFactory.getUserRepository();

    try {
      // Check if user already has a full account
      const userExists = await userRepo.exists(result.data.email);
      if (userExists) {
        return fail(400, {
          email,
          userExists: true,
          message: "You already have an account. Please log in."
        });
      }

      // Check for existing waitlist user
      const exists = await waitlistRepo.exists(result.data.email);
      
      if (exists) {
        // We don't want to reveal if an email is already registered for security/privacy,
        // so we'll just redirect to success as if it worked.
        // Alternatively, we could show a "You're already on the list!" message.
        // Let's go with the success redirect to be safe and simple.
        throw redirect(303, "/signup/success");
      }

      await waitlistRepo.create({ email: result.data.email });
    } catch (error) {
      if (isRedirect(error)) throw error; // Re-throw redirects
      
      console.error('Waitlist error:', error);
      return fail(500, {
        email,
        message: 'Something went wrong. Please try again later.'
      });
    }

    throw redirect(303, '/signup/success');
  }
};
