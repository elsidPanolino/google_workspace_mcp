import { google } from "googleapis";

export class AppsScriptClient {
  constructor(auth) {
    this.script = google.script({ version: "v1", auth });
    this.drive = google.drive({ version: "v3", auth });
  }

  async createProject(title, parentId) {
    const requestBody = { title };
    if (parentId) requestBody.parentId = parentId;
    const res = await this.script.projects.create({ requestBody });
    return res.data;
  }

  async getProject(scriptId) {
    const res = await this.script.projects.get({ scriptId });
    return res.data;
  }

  async getProjectContent(scriptId) {
    const res = await this.script.projects.getContent({ scriptId });
    return res.data;
  }

  async updateProjectContent(scriptId, files) {
    const res = await this.script.projects.updateContent({
      scriptId,
      requestBody: { files },
    });
    return res.data;
  }

  async listProjects(pageSize = 20, query) {
    let q = "mimeType='application/vnd.google-apps.script'";
    if (query) q += ` and ${query}`;
    const res = await this.drive.files.list({
      q,
      pageSize,
      fields: "files(id,name,createdTime,modifiedTime)",
      orderBy: "modifiedTime desc",
    });
    return res.data;
  }

  async createVersion(scriptId, description) {
    const requestBody = {};
    if (description) requestBody.description = description;
    const res = await this.script.projects.versions.create({ scriptId, requestBody });
    return res.data;
  }

  async listVersions(scriptId) {
    const res = await this.script.projects.versions.list({ scriptId });
    return res.data;
  }

  async createDeployment(scriptId, versionNumber, description) {
    const requestBody = { versionNumber };
    if (description) requestBody.description = description;
    const res = await this.script.projects.deployments.create({ scriptId, requestBody });
    return res.data;
  }

  async listDeployments(scriptId) {
    const res = await this.script.projects.deployments.list({ scriptId });
    return res.data;
  }

  async updateDeployment(scriptId, deploymentId, versionNumber, description) {
    const requestBody = {
      deploymentConfig: { versionNumber, description: description || "" },
    };
    const res = await this.script.projects.deployments.update({
      scriptId,
      deploymentId,
      requestBody,
    });
    return res.data;
  }

  async deleteDeployment(scriptId, deploymentId) {
    const res = await this.script.projects.deployments.delete({ scriptId, deploymentId });
    return res.data;
  }

  async runScript(scriptId, functionName, parameters) {
    const requestBody = { function: functionName };
    if (parameters) requestBody.parameters = parameters;
    const res = await this.script.scripts.run({ scriptId, requestBody });
    return res.data;
  }
}
