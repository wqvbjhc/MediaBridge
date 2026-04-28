import { DownloaderForm } from "@/components/DownloaderForm";

export default function Home() {
  return (
    <main className="min-h-screen py-20 px-4 md:px-8">
      <div className="max-w-5xl mx-auto flex flex-col items-center justify-center space-y-12">
        <header className="text-center space-y-6 relative">
          <div className="inline-block relative">
            <div className="absolute -inset-2 bg-primary transform -skew-x-6 z-0 shadow-[8px_8px_0px_0px_#000]"></div>
            <h1 className="relative z-10 text-5xl md:text-7xl font-black uppercase text-white tracking-tighter px-8 py-4">
              Video Downloader
            </h1>
          </div>
          <p className="mt-8 text-lg md:text-xl font-bold bg-yellow-300 text-black inline-block px-4 py-2 border-4 border-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#000]">
            快速 · 免费 · 无水印
          </p>
        </header>

        <section className="w-full mt-12">
          <DownloaderForm />
        </section>

        {/* Supported Platforms */}
        <div className="mt-20 w-full max-w-3xl">
          <p className="text-center text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
            支持的平台
          </p>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {["YouTube", "抖音", "今日头条", "Bilibili", "TikTok", "小红书"].map((name) => (
              <div
                key={name}
                className="text-center font-black text-sm uppercase tracking-wider py-3 px-2 border-2 border-gray-300 text-gray-500 hover:border-black hover:text-black hover:shadow-[3px_3px_0px_0px_#000] transition-all cursor-default"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
