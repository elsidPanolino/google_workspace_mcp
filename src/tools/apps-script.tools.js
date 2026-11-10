import { z } from "zod";

export function registerAppsScriptTools(server, client, handler) {
  server.tool(
    "gas_list_projects",
    "List Apps Script projects accessible to the user.",
    { pageSize: z.number().optional(), query: z.string().optional() },
    handler(async ({ pageSize, query }) => client.listProjects(pageSize || 20, query))
  );

  server.tool(
    "gas_create_project",
    "Create a new Apps Script project. Provide parentId to bind it to a Sheet/Doc.",
    { title: z.string(), parentId: z.string().optional() },
    handler(async ({ title, parentId }) => client.createProject(title, parentId))
  );

  server.tool(
    "gas_get_project",
    "Get project metadata.",
    { scriptId: z.string() },
    handler(async ({ scriptId }) => client.getProject(scriptId))
  );

  server.tool(
    "gas_get_content",
    "Get all files in a script project with full source.",
    { scriptId: z.string() },
    handler(async ({ scriptId }) => client.getProjectContent(scriptId))
  );

  server.tool(
    "gas_update_content",
    "FULL REPLACEMENT of project files. Always get_content first. files = [{name, type, source}].",
    {
      scriptId: z.string(),
      files: z.array(
        z.object({
          name: z.string(),
          type: z.enum(["SERVER_JS", "HTML", "JSON"]),
          source: z.string(),
        })
      ),
    },
    handler(async ({ scriptId, files }) => client.updateProjectContent(scriptId, files))
  );

  server.tool(
    "gas_patch_content",
    "Safer than gas_update_content: find-and-replace edits inside ONE file; all other files are left untouched and never resent. Each find must match exactly once (or set replaceAll). Backs up the old content to backups/gas/ and verifies the write. Use dryRun to preview.",
    {
      scriptId: z.string(),
      file: z.string().describe('File name as shown by gas_get_content, e.g. "Code" or "appsscript"'),
      edits: z
        .array(
          z.object({
            find: z.string().min(1),
            replace: z.string(),
            replaceAll: z.boolean().optional(),
          })
        )
        .min(1)
        .describe("Applied in order, each on the result of the previous one"),
      dryRun: z.boolean().optional(),
    },
    handler(async ({ scriptId, file, edits, dryRun }) => client.patchFile(scriptId, file, edits, dryRun))
  );

  server.tool(
    "gas_put_file",
    "Replace or add ONE file in a script project with the contents of a local file (read by the server, so nothing is retyped). localPath must be inside the repo's scripts/ or backups/ folder. Other files untouched; backs up to backups/gas/ and verifies the write. Use dryRun to preview.",
    {
      scriptId: z.string(),
      file: z.string().describe('File name in the project, e.g. "Code" or "appsscript"'),
      type: z.enum(["SERVER_JS", "HTML", "JSON"]),
      localPath: z.string().describe("Path relative to the repo root, e.g. scripts/lib-Code.gs"),
      dryRun: z.boolean().optional(),
    },
    handler(async ({ scriptId, file, type, localPath, dryRun }) =>
      client.putFile(scriptId, file, type, localPath, dryRun)
    )
  );

  server.tool(
    "gas_create_version",
    "Create an immutable version. Required before deploying.",
    { scriptId: z.string(), description: z.string().optional() },
    handler(async ({ scriptId, description }) => client.createVersion(scriptId, description))
  );

  server.tool(
    "gas_list_versions",
    "List versions of a script project.",
    { scriptId: z.string() },
    handler(async ({ scriptId }) => client.listVersions(scriptId))
  );

  server.tool(
    "gas_deploy",
    "Create a deployment for a version.",
    { scriptId: z.string(), versionNumber: z.number(), description: z.string().optional() },
    handler(async ({ scriptId, versionNumber, description }) =>
      client.createDeployment(scriptId, versionNumber, description)
    )
  );

  server.tool(
    "gas_list_deployments",
    "List deployments of a script project.",
    { scriptId: z.string() },
    handler(async ({ scriptId }) => client.listDeployments(scriptId))
  );

  server.tool(
    "gas_update_deployment",
    "Point a deployment at a different version.",
    {
      scriptId: z.string(),
      deploymentId: z.string(),
      versionNumber: z.number(),
      description: z.string().optional(),
    },
    handler(async ({ scriptId, deploymentId, versionNumber, description }) =>
      client.updateDeployment(scriptId, deploymentId, versionNumber, description)
    )
  );

  server.tool(
    "gas_delete_deployment",
    "Delete a deployment.",
    { scriptId: z.string(), deploymentId: z.string() },
    handler(async ({ scriptId, deploymentId }) => client.deleteDeployment(scriptId, deploymentId))
  );

  server.tool(
    "gas_run_script",
    "Run a function in a deployed (API-executable) script project.",
    {
      scriptId: z.string(),
      functionName: z.string(),
      parameters: z.array(z.any()).optional(),
    },
    handler(async ({ scriptId, functionName, parameters }) =>
      client.runScript(scriptId, functionName, parameters)
    )
  );
}
