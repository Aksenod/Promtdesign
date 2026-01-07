import { env } from "@/env";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest } from "next/server";

export async function createClient(request: NextRequest) {
    // Create a server's supabase client with cookies from the request
    // This is used in API routes where we need to read cookies from the request
    return createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    // In API routes, we can't set cookies directly on the response
                    // The cookies will be set by the Supabase client when needed
                    // This is handled by the middleware for subsequent requests
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value);
                    });
                },
            },
        },
    );
}
