import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, ProtectedRoute, AdminRoute } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { ThemeProvider } from "@/components/theme-provider";

import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import CourseOverview from "@/pages/course-overview";
import TopicsList from "@/pages/topics-list";
import TopicDetail from "@/pages/topic-detail";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminUserDetail from "@/pages/admin/user-detail";
import AdminCourses from "@/pages/admin/courses";
import AdminContact from "@/pages/admin/contact";
import AdminLogs from "@/pages/admin/logs";
import PaymentSuccess from "@/pages/payment/success";
import PaymentError from "@/pages/payment/error";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/payment/success" component={PaymentSuccess} />
        <Route path="/payment/error" component={PaymentError} />
        
        <Route path="/dashboard">
          {() => <ProtectedRoute><Dashboard /></ProtectedRoute>}
        </Route>
        <Route path="/courses/:slug">
          {() => <ProtectedRoute><CourseOverview /></ProtectedRoute>}
        </Route>
        <Route path="/sections/:sectionId/topics">
          {() => <ProtectedRoute><TopicsList /></ProtectedRoute>}
        </Route>
        <Route path="/topics/:topicId">
          {() => <ProtectedRoute><TopicDetail /></ProtectedRoute>}
        </Route>

        <Route path="/admin">
          {() => <AdminRoute><AdminDashboard /></AdminRoute>}
        </Route>
        <Route path="/admin/users">
          {() => <AdminRoute><AdminUsers /></AdminRoute>}
        </Route>
        <Route path="/admin/users/:id">
          {() => <AdminRoute><AdminUserDetail /></AdminRoute>}
        </Route>
        <Route path="/admin/course">
          {() => <AdminRoute><AdminCourses /></AdminRoute>}
        </Route>
        <Route path="/admin/contact">
          {() => <AdminRoute><AdminContact /></AdminRoute>}
        </Route>
        <Route path="/admin/logs">
          {() => <AdminRoute><AdminLogs /></AdminRoute>}
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="fizyka-theme">
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
