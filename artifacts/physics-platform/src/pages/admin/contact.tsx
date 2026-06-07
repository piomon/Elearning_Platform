import { useListContactMessages, useUpdateContactMessage } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminContact() {
  const { data, isLoading, refetch } = useListContactMessages({});
  const updateStatus = useUpdateContactMessage();

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold">Wiadomości z formularza</h1>
      {isLoading ? <p>Ładowanie...</p> : (
        <div className="space-y-4">
          {data?.map(msg => (
            <Card key={msg.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex justify-between">
                  <span>{msg.subject}</span>
                  <span className="text-sm bg-secondary px-2 py-1 rounded">{msg.status}</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{msg.name} ({msg.email})</p>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{msg.message}</p>
                <div className="mt-4 flex gap-2">
                  {msg.status !== 'read' && (
                    <Button variant="outline" size="sm" onClick={() => updateStatus.mutate({ id: msg.id, data: { status: 'read' } }, { onSuccess: () => refetch() })}>Oznacz jako przeczytane</Button>
                  )}
                  {msg.status !== 'closed' && (
                    <Button variant="outline" size="sm" onClick={() => updateStatus.mutate({ id: msg.id, data: { status: 'closed' } }, { onSuccess: () => refetch() })}>Zamknij zgłoszenie</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {data?.length === 0 && <p className="text-center py-8">Brak wiadomości</p>}
        </div>
      )}
    </div>
  );
}
