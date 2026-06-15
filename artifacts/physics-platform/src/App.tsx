import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, ProtectedRoute, AccessRoute } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { AdminPage } from "@/components/admin-layout";
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
import AdminAiSettings from "@/pages/admin/ai-settings";
import AdminVideos from "@/pages/admin/videos";
import AdminContact from "@/pages/admin/contact";
import AdminLogs from "@/pages/admin/logs";
import AdminCourseDebug from "@/pages/admin/course-debug";
import AdminLanding from "@/pages/admin/landing";
import AdminPricing from "@/pages/admin/pricing";
import AdminFaq from "@/pages/admin/faq";
import AdminSeo from "@/pages/admin/seo";
import PaymentSuccess from "@/pages/payment/success";
import PaymentError from "@/pages/payment/error";
import Regulamin from "@/pages/regulamin";
import Privacy from "@/pages/privacy";
import NotFound from "@/pages/not-found";
import { PurchaseResume } from "@/hooks/use-purchase";

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
        <Route path="/regulamin" component={Regulamin} />
        <Route path="/polityka-prywatnosci" component={Privacy} />
        
        <Route path="/dashboard">
          {() => <ProtectedRoute><Dashboard /></ProtectedRoute>}
        </Route>
        <Route path="/courses/:slug">
          {() => <AccessRoute><CourseOverview /></AccessRoute>}
        </Route>
        <Route path="/sections/:sectionId/topics">
          {() => <AccessRoute><TopicsList /></AccessRoute>}
        </Route>
        <Route path="/topics/:topicId">
          {() => <ProtectedRoute><TopicDetail /></ProtectedRoute>}
        </Route>

        <Route path="/admin">
          {() => <AdminPage><AdminDashboard /></AdminPage>}
        </Route>
        <Route path="/admin/users">
          {() => <AdminPage><AdminUsers /></AdminPage>}
        </Route>
        <Route path="/admin/users/:id">
          {() => <AdminPage><AdminUserDetail /></AdminPage>}
        </Route>
        <Route path="/admin/courses">
          {() => <AdminPage><AdminCourses /></AdminPage>}
        </Route>
        <Route path="/admin/videos">
          {() => <AdminPage><AdminVideos /></AdminPage>}
        </Route>
        <Route path="/admin/ai">
          {() => <AdminPage><AdminAiSettings /></AdminPage>}
        </Route>
        <Route path="/admin/landing">
          {() => <AdminPage><AdminLanding /></AdminPage>}
        </Route>
        <Route path="/admin/pricing">
          {() => <AdminPage><AdminPricing /></AdminPage>}
        </Route>
        <Route path="/admin/faq">
          {() => <AdminPage><AdminFaq /></AdminPage>}
        </Route>
        <Route path="/admin/seo">
          {() => <AdminPage><AdminSeo /></AdminPage>}
        </Route>
        <Route path="/admin/contact">
          {() => <AdminPage><AdminContact /></AdminPage>}
        </Route>
        <Route path="/admin/logs">
          {() => <AdminPage><AdminLogs /></AdminPage>}
        </Route>
        <Route path="/admin/course-debug">
          {() => <AdminPage><AdminCourseDebug /></AdminPage>}
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
              <PurchaseResume />
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
