import { useListAdminCourses } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminCourses() {
  const { data, isLoading } = useListAdminCourses();

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold">Zarządzanie Kursami</h1>
      {isLoading ? <p>Ładowanie...</p> : (
        <Card>
          <CardHeader><CardTitle>Dostępne kursy</CardTitle></CardHeader>
          <CardContent>
            {data?.map(course => (
              <div key={course.id} className="border-b pb-4 mb-4">
                <h3 className="text-xl font-bold">{course.title}</h3>
                <p className="text-muted-foreground">{course.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
