export const dynamic = 'force-dynamic';

export default async function MobileCallback({ searchParams }: { searchParams: Promise<{ code?: string; role?: string }> }) {
  const { code, role } = await searchParams;
  const url = new URL('collabdeal://auth/callback');
  if (code && code.length <= 2048) url.searchParams.set('code', code);
  if (role === 'creator' || role === 'brand') url.searchParams.set('role', role);
  return <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6"><h1 className="text-2xl font-bold">Return to Collab Deal OS</h1><p className="mt-3 text-sm leading-6 text-slate-500">Finish signing in inside the Android app.</p>{code ? <a className="mt-6 rounded-xl bg-violet-600 px-5 py-4 text-center font-semibold text-white" href={url.href}>Open the app</a> : <p role="alert" className="mt-5 text-sm text-red-700">Sign-in could not be completed. Return to the app and try again.</p>}</main>;
}
