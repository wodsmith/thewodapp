"use client";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Users,
  MapPin,
  BookOpen,
  Settings,
  Zap,
  Clock,
  Trophy,
} from "lucide-react";
import Link from "next/link";

const Index = () => {
  const [stats] = useState({
    totalCoaches: 8,
    totalClasses: 24,
    locations: 4,
    upcomingSchedules: 3,
  });

  const quickActions = [
    {
      title: "Generate Schedule",
      description: "AI-powered weekly schedule generation",
      icon: Zap,
      href: "/schedule",
      color: "bg-gradient-to-br from-orange-500 to-pink-600",
      textColor: "text-white",
    },
    {
      title: "Manage Coaches",
      description: "Add coaches and set their availability",
      icon: Users,
      href: "/coaches",
      color: "bg-gradient-to-br from-blue-500 to-purple-600",
      textColor: "text-white",
    },
    {
      title: "Class Catalog",
      description: "Define your gym's class offerings",
      icon: BookOpen,
      href: "/classes",
      color: "bg-gradient-to-br from-teal-500 to-blue-600",
      textColor: "text-white",
    },
    {
      title: "Gym Setup",
      description: "Configure locations and settings",
      icon: Settings,
      href: "/setup",
      color: "bg-gradient-to-br from-purple-500 to-indigo-600",
      textColor: "text-white",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-orange-500 to-pink-600 p-2 rounded-xl">
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  Gym Scheduler AI
                </h1>
                <p className="text-sm text-slate-600">
                  Intelligent class scheduling
                </p>
              </div>
            </div>
            <nav className="hidden md:flex items-center space-x-1">
              {[
                { name: "Schedule", href: "/schedule", icon: Calendar },
                { name: "Coaches", href: "/coaches", icon: Users },
                { name: "Classes", href: "/classes", icon: BookOpen },
                { name: "Setup", href: "/setup", icon: MapPin },
              ].map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-white/60 hover:text-slate-900 transition-all duration-200"
                >
                  <item.icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-slate-800 via-blue-800 to-purple-800 bg-clip-text text-transparent">
            Automate Your Gym Scheduling
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-8">
            Let AI handle the complexity of coach assignments, location
            conflicts, and skill requirements. Generate optimized schedules in
            seconds, not hours.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <Card className="bg-white/60 backdrop-blur-sm border-white/20 hover:bg-white/80 transition-all duration-300">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalCoaches}
              </div>
              <div className="text-sm text-slate-600">Active Coaches</div>
            </CardContent>
          </Card>
          <Card className="bg-white/60 backdrop-blur-sm border-white/20 hover:bg-white/80 transition-all duration-300">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {stats.totalClasses}
              </div>
              <div className="text-sm text-slate-600">Weekly Classes</div>
            </CardContent>
          </Card>
          <Card className="bg-white/60 backdrop-blur-sm border-white/20 hover:bg-white/80 transition-all duration-300">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-teal-600">
                {stats.locations}
              </div>
              <div className="text-sm text-slate-600">Locations</div>
            </CardContent>
          </Card>
          <Card className="bg-white/60 backdrop-blur-sm border-white/20 hover:bg-white/80 transition-all duration-300">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {stats.upcomingSchedules}
              </div>
              <div className="text-sm text-slate-600">Pending Schedules</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {quickActions.map((action, index) => (
            <Link key={index} href={action.href as any} className="group">
              <Card className="h-full bg-white/60 backdrop-blur-sm border-white/20 hover:bg-white/80 hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                <CardContent className="p-6">
                  <div
                    className={`${action.color} p-3 rounded-xl mb-4 w-fit group-hover:scale-110 transition-transform duration-300`}
                  >
                    <action.icon className={`h-6 w-6 ${action.textColor}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">
                    {action.title}
                  </h3>
                  <p className="text-sm text-slate-600">{action.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Recent Activity */}
        <Card className="bg-white/60 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-slate-600" />
              <span>Recent Activity</span>
            </CardTitle>
            <CardDescription>
              Latest updates and schedule changes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  action: "Schedule generated",
                  time: "2 hours ago",
                  status: "success",
                },
                {
                  action: "Coach availability updated",
                  time: "4 hours ago",
                  status: "info",
                },
                {
                  action: "New class added to catalog",
                  time: "1 day ago",
                  status: "success",
                },
                {
                  action: "Location conflict resolved",
                  time: "2 days ago",
                  status: "warning",
                },
              ].map((item, index) => (
                <div
                  key={item.action}
                  className="flex items-center justify-between py-2 border-b border-slate-200 last:border-b-0"
                >
                  <div className="flex items-center space-x-3">
                    <Badge
                      variant={
                        item.status === "success"
                          ? "default"
                          : item.status === "warning"
                          ? "destructive"
                          : "secondary"
                      }
                      className="w-2 h-2 p-0 rounded-full"
                    />
                    <span className="text-sm text-slate-700">
                      {item.action}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">{item.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Index;
