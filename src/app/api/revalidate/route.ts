import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * WordPress can call this endpoint when a post is published/updated. It
 * revalidates the 'wordpress' cache tag and the public blog routes so the
 * next request re-fetches fresh CMS data.
 *
 * Required env vars:
 *   REVALIDATION_SECRET — shared secret set in both WordPress and Hostinger
 */
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const slug = request.nextUrl.searchParams.get('slug');

  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  revalidateTag('wordpress', 'max');
  revalidatePath('/blog');

  if (slug) {
    revalidatePath(`/blog/${slug}`);
  }

  return NextResponse.json({
    revalidated: true,
    paths: slug ? ['/blog', `/blog/${slug}`] : ['/blog'],
    timestamp: Date.now(),
  });
}
