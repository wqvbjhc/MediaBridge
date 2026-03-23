export function DotGridBackground({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative min-h-screen w-full bg-background overflow-hidden">
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, #1a202c 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                    opacity: 0.1
                }}
            />
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
}
