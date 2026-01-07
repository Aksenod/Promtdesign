import { env } from '@/env';
import { logAgentEvent } from '@/utils/agent-log';
import { previewDomains, toDomainInfoFromPreview } from '@onlook/db';
import { getValidSubdomain } from '@onlook/utility';
import { TRPCError } from '@trpc/server';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../../trpc';

export const previewRouter = createTRPCRouter({
    get: protectedProcedure.input(z.object({
        projectId: z.string(),
    })).query(async ({ ctx, input }) => {
        const preview = await ctx.db.query.previewDomains.findFirst({
            where: eq(previewDomains.projectId, input.projectId),
        });
        logAgentEvent({
            location: 'preview.ts:13',
            message: 'get preview domain',
            data: {
                projectId: input.projectId,
                previewExists: !!preview,
                fullDomain: preview?.fullDomain,
                hasUndefined: preview?.fullDomain?.includes('.undefined'),
            },
        });
        if (!preview) {
            return null;
        }
        // Fix domain if it contains .undefined
        if (preview.fullDomain.includes('.undefined')) {
            logAgentEvent({
                location: 'preview.ts:20',
                message: 'detected .undefined in domain, fixing',
                data: {
                    oldDomain: preview.fullDomain,
                    hostingDomain: env.NEXT_PUBLIC_HOSTING_DOMAIN,
                },
            });
            if (!env.NEXT_PUBLIC_HOSTING_DOMAIN) {
                logAgentEvent({
                    location: 'preview.ts:24',
                    message: 'cannot fix domain, hosting domain not configured',
                    hypothesisId: 'B',
                    data: { projectId: input.projectId },
                });
                return null;
            }
            const hostingDomain = env.NEXT_PUBLIC_HOSTING_DOMAIN;
            const subdomain = getValidSubdomain(input.projectId);
            const fixedDomain = `${subdomain}.${hostingDomain}`;
            logAgentEvent({
                location: 'preview.ts:30',
                message: 'updating domain in database',
                data: {
                    oldDomain: preview.fullDomain,
                    fixedDomain,
                },
            });
            const [updated] = await ctx.db.update(previewDomains)
                .set({ fullDomain: fixedDomain })
                .where(eq(previewDomains.id, preview.id))
                .returning();
            if (updated) {
                return toDomainInfoFromPreview(updated);
            }
        }
        return toDomainInfoFromPreview(preview);
    }),
    create: protectedProcedure.input(z.object({
        projectId: z.string(),
    })).mutation(async ({ ctx, input }) => {
        logAgentEvent({
            location: 'preview.ts:52',
            message: 'create preview domain entry',
            data: {
                projectId: input.projectId,
                hostingDomain: env.NEXT_PUBLIC_HOSTING_DOMAIN,
                hostingDomainType: typeof env.NEXT_PUBLIC_HOSTING_DOMAIN,
            },
        });
        if (!env.NEXT_PUBLIC_HOSTING_DOMAIN) {
            logAgentEvent({
                location: 'preview.ts:56',
                message: 'hosting domain is undefined, cannot create new domain',
                hypothesisId: 'B',
                data: { projectId: input.projectId },
            });
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Hosting domain is not configured. Please set NEXT_PUBLIC_HOSTING_DOMAIN environment variable.',
            });
        }
        // Check if the domain is already taken by another project
        // This should never happen, but just in case
        const subdomain = getValidSubdomain(input.projectId);
        const hostingDomain = env.NEXT_PUBLIC_HOSTING_DOMAIN;
        logAgentEvent({
            location: 'preview.ts:65',
            message: 'before domain construction',
            hypothesisId: 'C',
            data: { subdomain, hostingDomain },
        });
        const domain = `${subdomain}.${hostingDomain}`;
        logAgentEvent({
            location: 'preview.ts:35',
            message: 'domain constructed',
            hypothesisId: 'D',
            data: {
                domain,
                subdomain,
                hostingDomain: env.NEXT_PUBLIC_HOSTING_DOMAIN,
            },
        });

        // Check for existing domain for this project (including broken ones with .undefined)
        const existingForProject = await ctx.db.query.previewDomains.findFirst({
            where: eq(previewDomains.projectId, input.projectId),
        });

        if (existingForProject) {
            // If existing domain is broken or different, update it
            if (existingForProject.fullDomain.includes('.undefined') || existingForProject.fullDomain !== domain) {
                logAgentEvent({
                    location: 'preview.ts:50',
                    message: 'updating existing broken domain',
                    data: {
                        oldDomain: existingForProject.fullDomain,
                        newDomain: domain,
                    },
                });
                const [updated] = await ctx.db.update(previewDomains)
                    .set({ fullDomain: domain })
                    .where(eq(previewDomains.id, existingForProject.id))
                    .returning();
                if (updated) {
                    return {
                        domain: updated.fullDomain,
                    };
                }
            } else {
                // Domain already exists and is correct
                return {
                    domain: existingForProject.fullDomain,
                };
            }
        }

        // Check if domain is taken by another project
        const existing = await ctx.db.query.previewDomains.findFirst({
            where: and(eq(previewDomains.fullDomain, domain), ne(previewDomains.projectId, input.projectId)),
        });

        if (existing) {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: `Domain ${domain} already taken`,
            });
        }

        const [preview] = await ctx.db.insert(previewDomains).values({
            fullDomain: domain,
            projectId: input.projectId,
        }).onConflictDoUpdate({
            target: [previewDomains.fullDomain],
            set: {
                projectId: input.projectId,
            },
        })
            .returning({
                fullDomain: previewDomains.fullDomain,
            });

        if (!preview) {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Failed to create preview domain, no preview domain returned',
            });
        }

        return {
            domain: preview.fullDomain,
        }
    }),
});
