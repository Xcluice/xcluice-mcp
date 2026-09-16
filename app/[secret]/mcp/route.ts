import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { supabase } from "../../../lib/supabase";
import crypto from "crypto";

// --- Simple secret-in-path auth ---------------------------------------
// Claude.ai's custom connector UI only supports OAuth or a fully open
// ("no authentication") server for personal (non-Team/Enterprise) plans.
// Since this server is for a single user, we use a secret segment in the
// URL path instead: https://your-app.vercel.app/<MCP_SECRET>/mcp
// Add the connector in Claude with "No Authentication" and that full URL.
// mcp-handler doesn't inspect the request pathname, so this works cleanly
// with a dynamic [secret] route segment.
function isAuthorized(secret: string): boolean {
  const expected = process.env.MCP_SECRET;
  if (!expected) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const mcpHandler = createMcpHandler((server) => {
  // ----- Tasks (homework/todo equivalent) -----
  server.registerTool(
    "list_tasks",
    {
      title: "List Tasks",
      description: "List tasks/study todos, optionally filtered by done status or priority.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(20),
        done: z.boolean().optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
      }),
    },
    async ({ limit, done, priority }) => {
      let query = supabase
        .from("tasks")
        .select("id,name,subject,notes,priority,deadline,hours,done,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (done !== undefined) query = query.eq("done", done);
      if (priority) query = query.eq("priority", priority);
      const { data, error } = await query;
      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "create_task",
    {
      title: "Create Task",
      description: "Create a new task/study todo.",
      inputSchema: z.object({
        id: z.string().min(1).describe("A unique id you choose for this task, e.g. a slug or uuid."),
        user_id: z.string().uuid().describe("The Supabase auth user id this task belongs to."),
        name: z.string().min(1),
        subject: z.string().optional(),
        notes: z.string().optional(),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
        deadline: z.string().optional().describe("Date in YYYY-MM-DD format."),
        hours: z.number().optional(),
      }),
    },
    async (input) => {
      const { data, error } = await supabase.from("tasks").insert(input).select().single();
      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
      }
      return { content: [{ type: "text", text: `Created task:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.registerTool(
    "update_task",
    {
      title: "Update Task",
      description: "Update an existing task by id — edit fields or mark it done.",
      inputSchema: z.object({
        id: z.string().min(1),
        name: z.string().optional(),
        subject: z.string().optional(),
        notes: z.string().optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        deadline: z.string().optional(),
        hours: z.number().optional(),
        done: z.boolean().optional(),
      }),
    },
    async ({ id, ...fields }) => {
      const updates: Record<string, unknown> = Object.fromEntries(
        Object.entries(fields).filter(([, v]) => v !== undefined)
      );
      if (Object.keys(updates).length === 0) {
        return { content: [{ type: "text", text: "No fields provided to update." }], isError: true };
      }
      updates.updated_at = new Date().toISOString();
      const { data, error } = await supabase.from("tasks").update(updates).eq("id", id).select().single();
      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
      }
      return { content: [{ type: "text", text: `Updated task:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  // ----- Social feed (messages/posts equivalent) -----
  server.registerTool(
    "list_social_posts",
    {
      title: "List Social Posts",
      description: "List recent posts from the social/study feed, optionally filtered by tag.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(20),
        tag: z.string().optional(),
      }),
    },
    async ({ limit, tag }) => {
      let query = supabase
        .from("social_posts")
        .select("id,author,body,tag,created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (tag) query = query.eq("tag", tag);
      const { data, error } = await query;
      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "create_social_post",
    {
      title: "Create Social Post",
      description: "Post a new entry to the social/study feed.",
      inputSchema: z.object({
        author: z.string().min(1),
        body: z.string().min(1),
        tag: z.string().default("tip"),
      }),
    },
    async (input) => {
      const { data, error } = await supabase.from("social_posts").insert(input).select().single();
      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
      }
      return { content: [{ type: "text", text: `Created post:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  // ----- Users -----
  server.registerTool(
    "list_users",
    {
      title: "List Users",
      description: "List app users (sp_users). Never returns password hashes.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(50),
      }),
    },
    async ({ limit }) => {
      const { data, error } = await supabase
        .from("sp_users")
        .select("id,username,created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
});

async function handler(req: Request, context: { params: Promise<{ secret: string }> }) {
  const { secret } = await context.params;
  if (!isAuthorized(secret)) {
    return new Response("Not found", { status: 404 });
  }
  return mcpHandler(req);
}

export { handler as GET, handler as POST };
