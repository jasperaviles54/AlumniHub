import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard, User, Users, Briefcase, Mail,
  BarChart3, Settings, LogOut, TrendingUp, GraduationCap, BookOpen,
  UserCog, Lightbulb,
} from "lucide-react";
import AiChatbot from "../AiChatbot";

const navItems = [
  { to: "/dashboard",           icon: LayoutDashboard, label: "Dashboard",           roles: ["alumni", "student", "admin", "career_advisor"] },
  { to: "/profile",             icon: User,            label: "My Profile",           roles: ["alumni", "student"] },
  { to: "/alumni",              icon: Users,           label: "Alumni Directory",     roles: ["admin"] },
  { to: "/students",            icon: BookOpen,        label: "Student Directory",    roles: ["admin", "career_advisor"] },
  { to: "/jobs",                icon: Briefcase,       label: "Jobs",                 roles: ["alumni", "student", "admin"] },
  { to: "/messages",            icon: Mail,            label: "Inbox",                roles: ["alumni", "student", "admin", "career_advisor"] },
  { to: "/career-prediction",   icon: TrendingUp,      label: "Career Prediction",    roles: ["alumni"] },
  { to: "/career-advice",       icon: Lightbulb,       label: "Career Advice",        roles: ["student"] },
  { to: "/reports",             icon: BarChart3,       label: "Reports",              roles: ["admin", "career_advisor"] },
  { to: "/curriculum-impact",   icon: GraduationCap,   label: "Curriculum Impact",    roles: ["admin", "career_advisor"] },
  { to: "/advisor-management",  icon: UserCog,         label: "Advisor Management",   roles: ["admin"] },
  { to: "/settings",            icon: Settings,        label: "Settings",             roles: ["alumni", "student", "admin", "career_advisor"] },
];

export default function Layout() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { supabase } = await import("../../services/supabase");
    await supabase.auth.signOut();
    navigate("/login");
  };

  const effectiveRole = profile?.role === "faculty" ? "career_advisor" : profile?.role;
  const filteredNav = navItems.filter((item) =>
    item.roles.includes(effectiveRole)
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold tracking-tight">AlumniHub</h1>
          <p className="text-xs text-gray-400 mt-1">Alumni Tracking System</p>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-semibold overflow-hidden flex-shrink-0">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-10 h-10 object-cover"/>
                : (profile?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || "?")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {profile?.first_name
                  ? `${profile.first_name} ${profile.last_name}`
                  : user?.email}
              </p>
              <p className="text-xs text-gray-400 capitalize">
                {profile?.role ? profile.role.replace("_", " ") : "User"}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {filteredNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-2.5 text-sm transition-colors duration-200 ${
                  isActive
                    ? "bg-blue-600 text-white border-r-3 border-blue-400"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-2 py-2 text-sm text-gray-400 hover:text-white transition-colors w-full"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>

      {/* Floating chatbot — students and alumni */}
      {(effectiveRole === "student" || effectiveRole === "alumni") && <AiChatbot />}
    </div>
  );
}
