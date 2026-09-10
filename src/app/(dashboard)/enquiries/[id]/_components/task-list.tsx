'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarClock, Trash2 } from 'lucide-react'
import { formatRelativeTime, fromLocalInputValue, isOverdue } from '@/lib/funnel'
import {
  useAddEnquiryTask,
  useDeleteEnquiryTask,
  useEnquiryTasks,
  useToggleEnquiryTask,
} from '@/hooks/useEnquiries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

export function TaskList({ enquiryId }: { enquiryId: string }) {
  const { data: tasks, isLoading } = useEnquiryTasks(enquiryId)
  const addTask = useAddEnquiryTask(enquiryId)
  const toggleTask = useToggleEnquiryTask(enquiryId)
  const deleteTask = useDeleteEnquiryTask(enquiryId)
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')

  const submit = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    addTask.mutate(
      { title: trimmed, due_at: fromLocalInputValue(dueAt) },
      {
        onSuccess: () => {
          setTitle('')
          setDueAt('')
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  const openCount = tasks?.filter((t) => !t.is_done).length ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Tasks{openCount > 0 ? ` · ${openCount} open` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add task */}
        <div className="space-y-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a follow-up task…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
            }}
          />
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="flex-1"
            />
            <Button size="sm" onClick={submit} disabled={addTask.isPending || !title.trim()}>
              Add
            </Button>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading tasks…</p>
        ) : !tasks || tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks yet. Add a follow-up above.</p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => {
              const overdue = !task.is_done && isOverdue(task.due_at)
              return (
                <li key={task.id} className="flex items-start gap-2.5 rounded-lg border p-2.5">
                  <Checkbox
                    checked={task.is_done}
                    onCheckedChange={(checked) =>
                      toggleTask.mutate({ taskId: task.id, isDone: checked as boolean })
                    }
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm break-words',
                        task.is_done && 'text-muted-foreground line-through',
                      )}
                    >
                      {task.title}
                    </p>
                    {task.due_at && (
                      <p
                        className={cn(
                          'mt-0.5 flex items-center gap-1 text-xs',
                          overdue ? 'text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        <CalendarClock className="h-3 w-3" />
                        {overdue ? 'Overdue · ' : ''}
                        {formatRelativeTime(task.due_at)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteTask.mutate(task.id)}
                    className="text-muted-foreground hover:text-destructive"
                    title="Delete task"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
