import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import type { Id } from "@offworld/backend/convex/_generated/dataModel";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authed/todos")({
	component: TodosRoute,
});

function TodosRoute() {
	const [newTodoText, setNewTodoText] = useState("");

	const todosQuery = useSuspenseQuery(convexQuery(api.todos.get, {}));
	const todos = todosQuery.data;

	const createTodo = useMutation(api.todos.create);
	const toggleTodo = useMutation(api.todos.toggle);
	const removeTodo = useMutation(api.todos.remove);

	const handleAddTodo = async (e: React.FormEvent) => {
		e.preventDefault();
		const text = newTodoText.trim();
		if (text) {
			setNewTodoText("");
			try {
				await createTodo({ text });
			} catch (error) {
				console.error("Failed to add todo:", error);
				setNewTodoText(text);
			}
		}
	};

	const handleToggleTodo = async (id: Id<"todos">, completed: boolean) => {
		try {
			await toggleTodo({ id, completed: !completed });
		} catch (error) {
			console.error("Failed to toggle todo:", error);
		}
	};

	const handleDeleteTodo = async (id: Id<"todos">) => {
		try {
			await removeTodo({ id });
		} catch (error) {
			console.error("Failed to delete todo:", error);
		}
	};

	return (
		<div className="container mx-auto max-w-2xl px-4 py-24">
			<div className="mb-12">
				<h1 className="font-normal font-serif text-5xl tracking-tight">
					Todo List
				</h1>
				<p className="mt-3 font-mono font-medium text-lg text-muted-foreground">
					Manage your tasks efficiently
				</p>
			</div>

			<Card className="border-2 border-primary/10">
				<CardContent className="pt-8">
					<form
						onSubmit={handleAddTodo}
						className="mb-8 flex items-center gap-3"
					>
						<Input
							value={newTodoText}
							onChange={(e) => setNewTodoText(e.target.value)}
							placeholder="Add a new task..."
							className="flex-1 text-base"
						/>
						<Button
							type="submit"
							disabled={!newTodoText.trim()}
							className="px-6"
						>
							Add
						</Button>
					</form>

					{todos?.length === 0 ? (
						<p className="py-12 text-center font-mono font-medium text-base text-muted-foreground">
							No todos yet. Add one above!
						</p>
					) : (
						<ul className="space-y-3">
							{todos?.map((todo) => (
								<li
									key={todo._id}
									className="flex items-center justify-between rounded-lg border-2 border-primary/10 bg-card p-4 transition-all hover:border-primary/20 hover:bg-accent/50"
								>
									<div className="flex items-center gap-4">
										<Checkbox
											checked={todo.completed}
											onCheckedChange={() =>
												handleToggleTodo(todo._id, todo.completed)
											}
											id={`todo-${todo._id}`}
										/>
										<label
											htmlFor={`todo-${todo._id}`}
											className={`cursor-pointer font-mono font-medium text-base ${
												todo.completed
													? "text-muted-foreground line-through"
													: ""
											}`}
										>
											{todo.text}
										</label>
									</div>
									<Button
										variant="ghost"
										size="icon"
										onClick={() => handleDeleteTodo(todo._id)}
										aria-label="Delete todo"
										className="h-9 w-9"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
