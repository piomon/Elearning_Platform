import { useListAdminLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminLogs() {
  const { data, isLoading } = useListAdminLogs({ limit: 50 });

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold">Logi systemowe</h1>
      <Card>
        <CardHeader><CardTitle>Ostatnie akcje administracyjne</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p>Ładowanie...</p> : (
            <div className="space-y-2 text-sm">
              {data?.map(log => (
                <div key={log.id} className="flex justify-between border-b py-2">
                  <div>
                    <span className="font-bold mr-2">{log.action}</span>
                    <span>{log.entityType} #{log.entityId}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()} przez {log.adminEmail}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
