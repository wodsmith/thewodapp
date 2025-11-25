
export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <main className="container mx-auto px-6 py-8">
            {children}
        </main>
    )
} 