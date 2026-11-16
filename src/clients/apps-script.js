import { google } from "googleapis";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve, sep } from "path";
import { fileURLToPath } from "url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

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

  // Find-and-replace inside ONE file, done server-side so the other files never
  // travel through the caller. Every edit must match exactly once (or set
  // replaceAll); on any failure nothing is written. The previous content is
  // saved to backups/gas/ first, and the write is read back and verified.
  async patchFile(scriptId, fileName, edits, dryRun = false) {
    const before = await this.getProjectContent(scriptId);
    const files = before.files || [];
    const target = files.find((f) => f.name === fileName);
    if (!target) {
      throw new Error(
        `File "${fileName}" not found. Files in project: ${files.map((f) => f.name).join(", ")}`
      );
    }

    let source = target.source;
    const applied = edits.map((e, i) => {
      const count = source.split(e.find).length - 1;
      if (count === 0) throw new Error(`Edit #${i + 1}: "find" text not found. Nothing was written.`);
      if (count > 1 && !e.replaceAll) {
        throw new Error(
          `Edit #${i + 1}: "find" text matches ${count} times. Make it unique or set replaceAll. Nothing was written.`
        );
      }
      source = e.replaceAll ? source.split(e.find).join(e.replace) : source.replace(e.find, () => e.replace);
      return { edit: i + 1, replaced: e.replaceAll ? count : 1 };
    });

    const summary = {
      file: fileName,
      edits: applied,
      charsBefore: target.source.length,
      charsAfter: source.length,
    };
    if (source === target.source) throw new Error("The edits change nothing. Nothing was written.");
    if (dryRun) return { ...summary, dryRun: true };

    const backup = await this._writeOneFile(scriptId, before, fileName, target.type, source);
    return { ...summary, dryRun: false, verified: true, backup };
  }

  // Replace (or add) ONE file with the contents of a local file, read server-side so
  // nothing is retyped through the caller. Only files under the repo's scripts/ or
  // backups/ folders can be uploaded, never .env or tokens/. Same backup + verify.
  async putFile(scriptId, fileName, type, localPath, dryRun = false) {
    const full = resolve(REPO_ROOT, localPath);
    const allowed = ["scripts", "backups"].some((d) => {
      const root = join(REPO_ROOT, d) + sep;
      return process.platform === "win32"
        ? full.toLowerCase().startsWith(root.toLowerCase())
        : full.startsWith(root);
    });
    if (!allowed) throw new Error(`localPath must be inside the repo's scripts/ or backups/ folder: ${full}`);
    const source = readFileSync(full, "utf8");
    if (!source.trim()) throw new Error(`Local file is empty: ${full}`);

    const before = await this.getProjectContent(scriptId);
    const existing = (before.files || []).find((f) => f.name === fileName);
    if (existing && existing.type !== type) {
      throw new Error(`File "${fileName}" exists with type ${existing.type}, not ${type}. Nothing was written.`);
    }
    const summary = {
      file: fileName,
      action: existing ? "replaced" : "added",
      charsBefore: existing ? existing.source.length : 0,
      charsAfter: source.length,
    };
    if (existing && existing.source === source) throw new Error("Local file is identical to the project file. Nothing was written.");
    if (dryRun) return { ...summary, dryRun: true };

    const backup = await this._writeOneFile(scriptId, before, fileName, type, source);
    return { ...summary, dryRun: false, verified: true, backup };
  }

  // Back up the project, write it with ONE file replaced or added, then read it back
  // and check that file matches and every other file is byte-for-byte unchanged.
  async _writeOneFile(scriptId, before, fileName, type, source) {
    const files = before.files || [];
    const backupDir = join(REPO_ROOT, "backups", "gas");
    mkdirSync(backupDir, { recursive: true });
    const backup = join(backupDir, `${scriptId}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(backup, JSON.stringify(before, null, 2));

    const next = files.map((f) => ({ name: f.name, type: f.type, source: f.name === fileName ? source : f.source }));
    if (!files.some((f) => f.name === fileName)) next.push({ name: fileName, type, source });
    await this.updateProjectContent(scriptId, next);

    const after = (await this.getProjectContent(scriptId)).files || [];
    const written = after.find((f) => f.name === fileName);
    const othersIntact =
      after.length === next.length &&
      files.every((f) => f.name === fileName || (after.find((a) => a.name === f.name) || {}).source === f.source);
    if (!written || written.source !== source || !othersIntact) {
      throw new Error(`Write could not be verified. Previous content is saved at ${backup}`);
    }
    return backup;
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
