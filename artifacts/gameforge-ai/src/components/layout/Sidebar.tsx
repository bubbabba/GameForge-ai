import { Link, useLocation } from "wouter";
import { LayoutDashboard, Gamepad2, User, Compass, Heart, HelpCircle, LogOut, LogIn } from "lucide-react";
import { useUser, useClerk, Show } from "@clerk/react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, section: "Personal", auth: false },
  { label: "My Games", href: "/my-games", icon: Gamepad2, section: "Personal", auth: true },
  { label: "Profile", href: "/profile", icon: User, section: "Personal", auth: true },
  { label: "Explore", href: "/explore", icon: Compass, section: "Community", auth: false },
  { label: "Favorites", href: "/favorites", icon: Heart, section: "Community", auth: true },
  { label: "Help", href: "/help", icon: HelpCircle, section: "Support", auth: false },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();

  const renderNavItems = (sectionName: string) => {
    return NAV_ITEMS.filter((item) => item.section === sectionName).map((item) => {
      const isActive = location === item.href || (location.startsWith(item.href) && item.href !== "/");
      
      const content = (
        <Link key={item.href} href={item.href} className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group text-sm font-medium",
          isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
        )}>
          <item.icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
          {item.label}
        </Link>
      );

      if (item.auth) {
        return (
          <Show when="signed-in" key={item.href}>
            {content}
          </Show>
        );
      }
      return content;
    });
  };

  return (
    <aside className="w-[240px] fixed top-0 bottom-0 left-0 bg-card border-r border-border flex flex-col z-50">
      <div className="p-6">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:border-primary/50 transition-colors shadow-[0_0_10px_rgba(34,197,94,0.15)]">
            <Gamepad2 className="w-5 h-5 text-primary" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">GameForge<span className="text-primary">.AI</span></span>
        </Link>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-8 overflow-y-auto">
        <div>
          <h4 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Personal</h4>
          <div className="space-y-1">{renderNavItems("Personal")}</div>
        </div>
        <div>
          <h4 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Community</h4>
          <div className="space-y-1">{renderNavItems("Community")}</div>
        </div>
        <div>
          <h4 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Support</h4>
          <div className="space-y-1">{renderNavItems("Support")}</div>
        </div>
      </nav>

      <div className="p-4 border-t border-border mt-auto">
        <Show when="signed-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold border border-primary/30">
                {user?.firstName?.charAt(0) || user?.username?.charAt(0) || "U"}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-sm font-medium leading-none truncate">{user?.firstName || user?.username}</span>
                <span className="text-xs text-muted-foreground mt-1 truncate">Creator</span>
              </div>
            </div>
            <button 
              onClick={() => signOut({ redirectUrl: "/" })}
              className="p-2 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </Show>
        <Show when="signed-out">
          <div className="flex flex-col gap-2">
            <Link href="/sign-in" className="w-full py-2 px-4 rounded-md text-sm font-medium bg-white/5 hover:bg-white/10 text-center transition-colors">
              Sign In
            </Link>
            <Link href="/sign-up" className="w-full py-2 px-4 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 text-center transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_20px_rgba(34,197,94,0.4)]">
              Sign Up
            </Link>
          </div>
        </Show>
      </div>
    </aside>
  );
}