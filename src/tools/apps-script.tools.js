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
