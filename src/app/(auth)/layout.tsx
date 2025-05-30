import NavFooterLayout from "@/layouts/NavFooterLayout";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return <NavFooterLayout renderFooter={false}>{children}</NavFooterLayout>;
}
