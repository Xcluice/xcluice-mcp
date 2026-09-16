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
  // ----- Homework -----
  server.registerTool(
    "list_homework",
    {
      title: "List Homework",
      description: "List homework/assignment entries from the Xcluice homework feed, most recent first.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(20),
      }),
    },
    async ({ limit }) => {
      const { data, error } = await supabase
        .from("homework")
        .select("id,title,subject,file_url,author_name,author_email,created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "create_homework",
    {
      title: "Create Homework",
      description: "Create a new homework/assignment entry in the Xcluice homework feed.",
      inputSchema: z.object({
        title: z.string().min(1),
        subject: z.string().min(1),
        file_url: z.union([z.string().url(), z.literal("")]).default(""),
        author_name: z.string().optional(),
        author_email: z.string().email().optional(),
        author_photo: z.string().url().optional(),
      }),
    },
    async (input) => {
      const { data, error } = await supabase.from("homework").insert(input).select().single();
      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
      }
      return { content: [{ type: "text", text: `Created homework entry:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.registerTool(
    "update_homework",
    {
      title: "Update Homework",
      description: "Update an existing homework/assignment entry by id.",
      inputSchema: z.object({
        id: z.number().int(),
        title: z.string().optional(),
        subject: z.string().optional(),
        file_url: z.string().url().optional(),
      }),
    },
    async ({ id, ...fields }) => {
      const updates = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
      if (Object.keys(updates).length === 0) {
        return { content: [{ type: "text", text: "No fields provided to update." }], isError: true };
      }
      const { data, error } = await supabase.from("homework").update(updates).eq("id", id).select().single();
      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
      }
      return { content: [{ type: "text", text: `Updated homework entry:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  // ----- Chat -----
  server.registerTool(
    "list_chat_messages",
    {
      title: "List Chat Messages",
      description: "List recent chat messages, optionally filtered by sender (uid) or recipient (to_uid).",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(200).default(50),
        uid: z.string().optional(),
        to_uid: z.string().optional(),
      }),
    },
    async ({ limit, uid, to_uid }) => {
      let query = supabase
        .from("chat_messages")
        .select("id,uid,name,text,to_uid,created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (uid) query = query.eq("uid", uid);
      if (to_uid) query = query.eq("to_uid", to_uid);
      const { data, error } = await query;
      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "post_chat_message",
    {
      title: "Post Chat Message",
      description:
        "Post a new chat message as a given user (uid/name), optionally as a direct message to another uid (to_uid).",
      inputSchema: z.object({
        uid: z.string().min(1),
        name: z.string().min(1),
        text: z.string().min(1),
        to_uid: z.string().optional(),
      }),
    },
    async (input) => {
      const { data, error } = await supabase.from("chat_messages").insert(input).select().single();
      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
      }
      return { content: [{ type: "text", text: `Posted message:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  // ----- Users -----
  server.registerTool(
    "list_chat_users",
    {
      title: "List Chat Users",
      description: "List chat users (uid, name, email, last active).",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(50),
      }),
    },
    async ({ limit }) => {
      const { data, error } = await supabase
        .from("chat_users")
        .select("uid,name,email,last_active")
        .order("last_active", { ascending: false })
        .limit(limit);
      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "list_team_members",
    {
      title: "List Team Members",
      description: "List Xcluice/Fosthub team members (username, display name, role). Never returns password hashes.",
      inputSchema: z.object({}),
    },
    async () => {
      const { data, error } = await supabase
        .from("fosthub_users")
        .select("id,username,display_name,role,avatar_url,created_at,last_active");
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
