#!/usr/bin/env node
import { linearRequest } from '../src/client.js';
import { print, toTable } from '../src/format.js';

const [, , ...argv] = process.argv;
const json = consumeFlag(argv, '--json');

if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
  usage();
  process.exit(0);
}

const [command, subcommand, ...rest] = argv;

try {
  if (command === 'me') {
    await runMe({ json });
  } else if (command === 'teams') {
    await runTeams({ json });
  } else if (command === 'projects' && subcommand === 'list') {
    await runProjectsList({ json, args: rest });
  } else if (command === 'projects' && subcommand === 'create') {
    await runProjectCreate({ json, args: rest });
  } else if (command === 'issues' && subcommand === 'list') {
    await runIssuesList({ json, args: rest });
  } else if (command === 'issues' && subcommand === 'create') {
    await runIssueCreate({ json, args: rest });
  } else if (command === 'issues' && subcommand === 'update') {
    await runIssueUpdate({ json, args: rest });
  } else if (command === 'comments' && subcommand === 'add') {
    await runCommentAdd({ json, args: rest });
  } else {
    usage(`Unknown command: ${argv.join(' ')}`);
    process.exit(1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function usage(message) {
  if (message) console.error(message + '\n');
  console.log(`linear-cli\n\nCommands:\n  me\n  teams\n  projects list [--team <teamKey>]\n  projects create --name <name> [--team <teamKey>] [--description <text>]\n  issues list [--team <teamKey>] [--project <projectId>] [--state <stateName>]\n  issues create --team <teamIdOrKey> --title <title> [--description <text>] [--project <projectId>] [--priority <0-4>]\n  issues update --id <issueId> [--title <title>] [--description <text>] [--state <stateId>] [--priority <0-4>] [--project <projectId>]\n  comments add --issue <issueId> --body <text>\n\nGlobal flags:\n  --json\n`);
}

function consumeFlag(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return false;
  args.splice(index, 1);
  return true;
}

function getOption(args, name, { required = false, fallback = undefined } = {}) {
  const index = args.indexOf(name);
  if (index === -1) {
    if (required) {
      throw new Error(`Missing required option ${name}`);
    }
    return fallback;
  }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Option ${name} requires a value`);
  }
  args.splice(index, 2);
  return value;
}

async function runMe({ json }) {
  const data = await linearRequest(`query Viewer { viewer { id name email displayName active } }`);
  if (json) return print(data.viewer, { json: true });
  print(toTable([data.viewer], ['id', 'name', 'email', 'displayName', 'active']));
}

async function runTeams({ json }) {
  const data = await linearRequest(`query Teams { teams { nodes { id key name } } }`);
  if (json) return print(data.teams.nodes, { json: true });
  print(toTable(data.teams.nodes, ['id', 'key', 'name']));
}

async function runProjectsList({ json, args }) {
  const team = getOption(args, '--team');
  const data = team
    ? await linearRequest(`query ProjectsByTeam($team: String!) { teams(filter: { key: { eq: $team } }) { nodes { key name projects { nodes { id name description state progress slugId } } } } }`, { team })
    : await linearRequest(`query Projects { projects { nodes { id name description state progress slugId } } }`);

  const projects = team
    ? (data.teams.nodes[0]?.projects.nodes ?? []).map((project) => ({ ...project, team }))
    : data.projects.nodes;

  const rows = projects.map((project) => ({
    id: project.id,
    name: project.name,
    state: project.state,
    team: project.team ?? '',
    progress: project.progress,
    slugId: project.slugId,
  }));
  if (json) return print(projects, { json: true });
  print(toTable(rows, ['id', 'name', 'state', 'team', 'progress', 'slugId']));
}

async function runProjectCreate({ json, args }) {
  const name = getOption(args, '--name', { required: true });
  const description = getOption(args, '--description');
  const teamKey = getOption(args, '--team');
  let teamIds = [];
  if (teamKey) {
    const teams = await linearRequest(`query TeamByKey($key: String!) { teams(filter: { key: { eq: $key } }) { nodes { id key name } } }`, { key: teamKey });
    const team = teams.teams.nodes[0];
    if (!team) throw new Error(`No team found for key ${teamKey}`);
    teamIds = [team.id];
  }
  const data = await linearRequest(`mutation ProjectCreate($input: ProjectCreateInput!) { projectCreate(input: $input) { success project { id name description state slugId } } }`, {
    input: {
      name,
      description,
      teamIds,
    },
  });
  if (json) return print(data.projectCreate, { json: true });
  print(toTable([{ id: data.projectCreate.project.id, name: data.projectCreate.project.name, state: data.projectCreate.project.state, slugId: data.projectCreate.project.slugId }], ['id', 'name', 'state', 'slugId']));
}

async function runIssuesList({ json, args }) {
  const team = getOption(args, '--team');
  const project = getOption(args, '--project');
  const state = getOption(args, '--state');
  const data = await linearRequest(`query Issues($team: String, $project: ID, $state: String) {
    issues(filter: {
      team: { key: { eq: $team } },
      project: { id: { eq: $project } },
      state: { name: { eq: $state } }
    }) {
      nodes {
        id
        identifier
        title
        priority
        url
        state { id name type }
        team { id key name }
        project { id name }
        assignee { id name }
      }
    }
  }`, { team: team ?? undefined, project: project ?? undefined, state: state ?? undefined });
  if (json) return print(data.issues.nodes, { json: true });
  const rows = data.issues.nodes.map((issue) => ({
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    state: issue.state?.name ?? '',
    team: issue.team?.key ?? '',
    project: issue.project?.name ?? '',
    priority: issue.priority,
  }));
  print(toTable(rows, ['id', 'identifier', 'title', 'state', 'team', 'project', 'priority']));
}

async function runIssueCreate({ json, args }) {
  const team = getOption(args, '--team', { required: true });
  const title = getOption(args, '--title', { required: true });
  const description = getOption(args, '--description');
  const projectId = getOption(args, '--project');
  const priority = getOption(args, '--priority');

  const teamId = await resolveTeamId(team);

  const data = await linearRequest(`mutation IssueCreate($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue {
        id
        identifier
        title
        url
        priority
        team { key }
        project { id name }
        state { id name }
      }
    }
  }`, {
    input: {
      teamId,
      title,
      description,
      projectId,
      priority: priority ? Number(priority) : undefined,
    },
  });
  if (json) return print(data.issueCreate, { json: true });
  print(toTable([{ id: data.issueCreate.issue.id, identifier: data.issueCreate.issue.identifier, title: data.issueCreate.issue.title, team: data.issueCreate.issue.team?.key ?? '', project: data.issueCreate.issue.project?.name ?? '', state: data.issueCreate.issue.state?.name ?? '', url: data.issueCreate.issue.url }], ['id', 'identifier', 'title', 'team', 'project', 'state', 'url']));
}

async function runIssueUpdate({ json, args }) {
  const id = getOption(args, '--id', { required: true });
  const title = getOption(args, '--title');
  const description = getOption(args, '--description');
  const stateId = getOption(args, '--state');
  const priority = getOption(args, '--priority');
  const projectId = getOption(args, '--project');

  const data = await linearRequest(`mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
    issueUpdate(id: $id, input: $input) {
      success
      issue {
        id
        identifier
        title
        url
        priority
        state { id name }
        project { id name }
      }
    }
  }`, {
    id,
    input: {
      title,
      description,
      stateId,
      projectId,
      priority: priority ? Number(priority) : undefined,
    },
  });
  if (json) return print(data.issueUpdate, { json: true });
  print(toTable([{ id: data.issueUpdate.issue.id, identifier: data.issueUpdate.issue.identifier, title: data.issueUpdate.issue.title, state: data.issueUpdate.issue.state?.name ?? '', project: data.issueUpdate.issue.project?.name ?? '', priority: data.issueUpdate.issue.priority, url: data.issueUpdate.issue.url }], ['id', 'identifier', 'title', 'state', 'project', 'priority', 'url']));
}

async function runCommentAdd({ json, args }) {
  const issueId = getOption(args, '--issue', { required: true });
  const body = getOption(args, '--body', { required: true });
  const data = await linearRequest(`mutation CommentCreate($input: CommentCreateInput!) {
    commentCreate(input: $input) {
      success
      comment { id body issue { id identifier title } }
    }
  }`, { input: { issueId, body } });
  if (json) return print(data.commentCreate, { json: true });
  print(toTable([{ id: data.commentCreate.comment.id, issue: data.commentCreate.comment.issue.identifier, title: data.commentCreate.comment.issue.title }], ['id', 'issue', 'title']));
}

async function resolveTeamId(value) {
  if (/^[0-9a-fA-F-]{36}$/.test(value)) return value;
  const data = await linearRequest(`query TeamByKey($key: String!) { teams(filter: { key: { eq: $key } }) { nodes { id key } } }`, { key: value });
  const team = data.teams.nodes[0];
  if (!team) throw new Error(`No team found for ${value}`);
  return team.id;
}
