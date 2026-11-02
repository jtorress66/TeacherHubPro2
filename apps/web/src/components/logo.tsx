import Image from 'next/image';

/** The TeacherHubPro mark and wordmark. The name is text, so it reads well in both themes. */
export function Logo({ size = 32 }: { readonly size?: number }) {
  return (
    <span className="logo">
      <Image src="/brand/logo-mark.png" alt="" width={size} height={size} priority />
      <span className="logo-word">
        TeacherHub<span className="logo-pro">Pro</span>
      </span>
    </span>
  );
}
