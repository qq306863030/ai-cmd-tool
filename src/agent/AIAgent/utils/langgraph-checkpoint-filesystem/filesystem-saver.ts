import { join } from 'path';
import { type RunnableConfig } from '@langchain/core/runnables';
import {
  BaseCheckpointSaver,
  copyCheckpoint,
  getCheckpointId,
  WRITES_IDX_MAP,
  type Checkpoint,
  type CheckpointListOptions,
  type CheckpointMetadata,
  type CheckpointTuple,
  type PendingWrite,
  type SerializerProtocol,
} from '@langchain/langgraph-checkpoint';
import { StorePathResolver } from './store-path-resolver';
import { checkFileExists, checkOrCreateFolder, listDirs, listFiles, readBinary, readJSON, safeDeleteFile, writeBinary, writeJSON } from './utils';
import type { ReactAgent } from 'langchain';

export class FileSystemSaver extends BaseCheckpointSaver {
  public pathResolver: StorePathResolver;

  constructor(options?: { serde?: SerializerProtocol; rootFolder?: string; splitter?: string }) {
    const { rootFolder, splitter, serde } = options ?? {};
    super(serde);
    this.pathResolver = new StorePathResolver(rootFolder, splitter);
  }

  // 还原到最后一次会话结束时的检查点，如有中断/错误历史则保存为文本文件
  async init(agentId: string, agent: ReactAgent<any>): Promise<string | null> {
    const { lastCheckPointId, allCheckPointId, interruptedSnaps } = await this.getLastCheckPointId(agentId, agent);
    let errorFilePath: string | null = null;

    // 如果存在未完成/异常中断的快照，将其提取保存为文本文件
    if (interruptedSnaps.length > 0) {
      const latestInterruptedSnap = interruptedSnaps[0];
      const messages = latestInterruptedSnap?.values?.messages || [];
      if (messages.length > 0) {
        const formattedText = this.formatMessagesToText(messages, latestInterruptedSnap.next);
        const threadDir = this.pathResolver.getThreadPath(agentId);
        await checkOrCreateFolder(threadDir);
        errorFilePath = join(threadDir, 'last_error_session.txt');
        await writeBinary(errorFilePath, Buffer.from(formattedText, 'utf-8'));
      }
    }

    if (lastCheckPointId && allCheckPointId.includes(lastCheckPointId)) {
      for (const checkpointId of allCheckPointId) {
        if (checkpointId !== lastCheckPointId) {
          // 删除中断/废弃的检查点
          const checkpointPath = this.pathResolver.getCheckpointFolderPath(agentId, this.pathResolver.defaultCheckpointNs, checkpointId);
          await safeDeleteFile(checkpointPath);
        } else {
          break;
        }
      }
    }

    return errorFilePath;
  }

  async getLastCheckPointId(agentId: string, agent: ReactAgent<any>) {
    const threadConfig = { configurable: { thread_id: agentId } };
    const history = [];
    // 关键：agent.graph 才是原生编译后的 LangGraph 实例
    const compiledGraph = agent.graph;
    const checkPointIds = [];
    // 遍历历史快照（最新到最旧）
    for await (const state of compiledGraph.getStateHistory(threadConfig)) {
      history.push(state);
      checkPointIds.push(state.config.configurable?.['checkpoint_id']);
    }
    // 找走完END(next为空)的快照
    const finishSnapIndex = history.findIndex((s) => s.next.length === 0);
    let lastCheckPointId: string | undefined = undefined;
    let interruptedSnaps: any[] = [];

    if (finishSnapIndex !== -1) {
      lastCheckPointId = history[finishSnapIndex].config.configurable?.['checkpoint_id'];
      // finishSnap 之前的快照均为未完成/中断快照
      interruptedSnaps = history.slice(0, finishSnapIndex);
    } else {
      // 若完全没有完成的快照，则全部快照均为中断快照
      interruptedSnaps = history;
    }

    return {
      lastCheckPointId,
      allCheckPointId: checkPointIds,
      interruptedSnaps,
    };
  }

  private formatMessagesToText(messages: any[], nextNodes: string[] = []): string {
    const lines: string[] = [];
    lines.push(`=== 上次未完成/出错会话历史记录 ===`);
    lines.push(`记录时间: ${new Date().toLocaleString()}`);
    if (nextNodes && nextNodes.length > 0) {
      lines.push(`中断时待执行节点: ${nextNodes.join(', ')}`);
    }
    lines.push(`-----------------------------------\n`);

    for (const msg of messages) {
      const type = msg._getType ? msg._getType() : (msg.role || 'message');
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      
      if (type === 'human' || type === 'user') {
        lines.push(`[User]: ${content}`);
      } else if (type === 'ai' || type === 'assistant') {
        lines.push(`[AI]: ${content}`);
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          lines.push(`[AI Tool Calls]: ${JSON.stringify(msg.tool_calls, null, 2)}`);
        }
      } else if (type === 'tool') {
        lines.push(`[Tool Return (${msg.name || msg.tool_call_id || ''})]: ${content}`);
      } else {
        lines.push(`[${type}]: ${content}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

   async *list(config: RunnableConfig, options?: CheckpointListOptions) {
    const { before, limit, filter } = options ?? {};
    const threadIds = config.configurable?.["thread_id"]
      ? [config.configurable["thread_id"]]
      : await listDirs(this.pathResolver.rootFolder); // list all folder names of threads if there is no thread_id

    const configCheckpointNamespace = config.configurable?.["checkpoint_ns"];
    const configCheckpointId = config.configurable?.["checkpoint_id"];
    for (const threadId of threadIds) {
      const checkpointNsPaths = await listDirs(this.pathResolver.getThreadPath(threadId)); // list all folder names of checkpoint namespaces
      for (const checkpointNsPath of checkpointNsPaths) {
        if (
          configCheckpointNamespace !== undefined &&
          // ! Notice here, the default value of param `checkpoint_ns` is actually `""`, but we use `__DEFAULT_NS__` folder name to represent it
          // Encode the config namespace for comparison, since disk names are already encoded
          checkpointNsPath !== StorePathResolver.encodePathComponent(configCheckpointNamespace || this.pathResolver.defaultCheckpointNs)
        ) {
          continue;
        }

        const checkpointIds = await listDirs(this.pathResolver.getCheckpointNsPath(threadId, checkpointNsPath));

        const sortedCheckpointIds = checkpointIds.sort((a, b) => b.localeCompare(a)); // sort checkpoint ids by descending order

        // Filter by checkpoint ID from config
        let filteredCheckpointIds = sortedCheckpointIds.filter((checkpointId) => {
          if (configCheckpointId && checkpointId !== configCheckpointId) {
            return false;
          }
          return true;
        });

        // Filter by checkpoint ID from before config
        filteredCheckpointIds = filteredCheckpointIds.filter((checkpointId) => {
          if (before && before.configurable?.["checkpoint_id"] && checkpointId >= before.configurable["checkpoint_id"]) {
            return false;
          }
          return true;
        });

        // limit the number of checkpoint tuples
        const limitedCheckpointTuples = filteredCheckpointIds.slice(0, limit);

        // get all checkpoint tuples
        const checkpointTuples = await Promise.all(
          limitedCheckpointTuples.map(async (checkpointId) => {
            return this.getTuple({
              configurable: {
                thread_id: threadId,
                // ! Notice here, the default value of param `checkpoint_ns` is actually `""`, but we use `__DEFAULT_NS__` folder name to represent it
                checkpoint_ns: checkpointNsPath === this.pathResolver.defaultCheckpointNs ? '' : checkpointNsPath,
                checkpoint_id: checkpointId,
              },
            });
          }),
        );

        // filter the checkpoint tuples by metadata
        for (const checkpointTuple of checkpointTuples) {
          if (!checkpointTuple) {
            continue;
          }

          if (
            filter &&
            !Object.entries(filter).every(
              ([key, value]) => (checkpointTuple?.metadata as unknown as Record<string, unknown>)[key] === value,
            )
          ) {
            continue;
          }

          yield checkpointTuple;
        }
      }
    }
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.['thread_id'];
    const checkpointNs = config.configurable?.['checkpoint_ns'];

    const checkpointId = getCheckpointId(config);

    if (checkpointId) {
      const checkpointsPath = this.pathResolver.getCheckpointsPath(threadId, checkpointNs, checkpointId);
      const accessed = await checkFileExists(checkpointsPath);

      if (accessed) {
        const extraPath = join(checkpointsPath, 'extra.json');
        const metadataPath = join(checkpointsPath, 'metadata');
        const checkpointPath = join(checkpointsPath, 'checkpoint');

        const [extraJson, metadata, checkpoint] = await Promise.all([readJSON(extraPath), readBinary(metadataPath), readBinary(checkpointPath)]);

        const [deserializedMetadata, deserializedCheckpoint] = await Promise.all([
          this.serde.loadsTyped('json', metadata),
          this.serde.loadsTyped('json', checkpoint),
        ]);

        const writesPath = this.pathResolver.getWritesPath(threadId, checkpointNs, checkpointId);

        const savedWritesFileNames = await listFiles(writesPath); // list all file names of writes binary

        const pendingWrites = await Promise.all(
          savedWritesFileNames.map(async (singleWriteFileName) => {
            const [taskId, channel] = this.pathResolver.splitWithSplitter(singleWriteFileName);
            const writeFilePath = join(writesPath, singleWriteFileName);
            const fileContent = await readBinary(writeFilePath);
            const deserializedWritesValue = await this.serde.loadsTyped('json', fileContent);
            return [taskId, channel, deserializedWritesValue] as [string, string, unknown];
          }),
        );

        const checkpointTuple: CheckpointTuple = {
          config,
          checkpoint: deserializedCheckpoint,
          metadata: deserializedMetadata,
          pendingWrites,
        };

        if (extraJson.parentCheckpointId) {
          checkpointTuple.parentConfig = {
            configurable: {
              thread_id: threadId,
              checkpoint_ns: checkpointNs,
              checkpoint_id: extraJson.parentCheckpointId,
            },
          };
        }

        return checkpointTuple;
      }
    } else {
      const checkpointNsPath = this.pathResolver.getCheckpointNsPath(threadId, checkpointNs);
      await checkOrCreateFolder(checkpointNsPath);

      const checkpointIds = await listDirs(checkpointNsPath); // list all folder names of checkpoints (the folder name is the checkpoint_id)
      const checkpointId = checkpointIds.sort((a, b) => b.localeCompare(a))[0]; // get the latest checkpoint id

      if (!checkpointId) {
        return undefined;
      }

      const checkpointsPath = this.pathResolver.getCheckpointsPath(threadId, checkpointNs, checkpointId);
      const accessed = await checkFileExists(checkpointsPath);

      if (accessed) {
        const extraPath = join(checkpointsPath, 'extra.json');
        const metadataPath = join(checkpointsPath, 'metadata');
        const checkpointPath = join(checkpointsPath, 'checkpoint');

        const [extraJson, metadata, checkpoint] = await Promise.all([readJSON(extraPath), readBinary(metadataPath), readBinary(checkpointPath)]);

        const [deserializedMetadata, deserializedCheckpoint] = await Promise.all([
          this.serde.loadsTyped('json', metadata),
          this.serde.loadsTyped('json', checkpoint),
        ]);

        const writesPath = this.pathResolver.getWritesPath(threadId, checkpointNs, checkpointId);

        const savedWritesFiles = await listFiles(writesPath); // list all file names of writes binary

        const pendingWrites = await Promise.all(
          savedWritesFiles.map(async (singleWriteFileName) => {
            const [taskId, channel] = this.pathResolver.splitWithSplitter(singleWriteFileName);
            const writeFilePath = join(writesPath, singleWriteFileName);
            const fileContent = await readBinary(writeFilePath);
            const deserializedWritesValue = await this.serde.loadsTyped('json', fileContent);
            return [taskId, channel, deserializedWritesValue] as [string, string, unknown];
          }),
        );

        const checkpointTuple: CheckpointTuple = {
          config: {
            configurable: {
              ...config.configurable,
              checkpoint_id: checkpointId, // set checkpoint_id to the latest checkpoint id
            },
          },
          checkpoint: deserializedCheckpoint,
          metadata: deserializedMetadata,
          pendingWrites,
        };

        if (extraJson.parentCheckpointId) {
          checkpointTuple.parentConfig = {
            configurable: {
              thread_id: threadId,
              checkpoint_ns: checkpointNs,
              checkpoint_id: extraJson.parentCheckpointId,
            },
          };
        }

        return checkpointTuple;
      }
    }

    return undefined;
  }

  async put(config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata) {
    const preparedCheckpoint: Partial<Checkpoint> = copyCheckpoint(checkpoint);
    const threadId = config.configurable?.['thread_id'];
    const checkpointNs = config.configurable?.['checkpoint_ns'];
    const parentCheckpointId = config.configurable?.['checkpoint_id']; // parent checkpoint id
    const checkpointId = checkpoint.id;

    if (threadId === undefined) {
      throw new Error(`Failed to put checkpoint. The passed RunnableConfig is missing a required "thread_id" field in its "configurable" property.`);
    }

    const checkpointsPath = this.pathResolver.getCheckpointsPath(threadId, checkpointNs, checkpointId);

    await checkOrCreateFolder(checkpointsPath);

    const [[, serializedCheckpoint], [, serializedMetadata]] = await Promise.all([
      this.serde.dumpsTyped(preparedCheckpoint),
      this.serde.dumpsTyped(metadata),
    ]);

    await writeBinary(join(checkpointsPath, 'checkpoint'), serializedCheckpoint);

    await writeBinary(join(checkpointsPath, 'metadata'), serializedMetadata);

    await writeJSON(join(checkpointsPath, 'extra.json'), { parentCheckpointId });

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: checkpointId,
      },
    };
  }

  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string) {
    const threadId = config.configurable?.['thread_id'];
    const checkpointId = config.configurable?.['checkpoint_id'];
    const checkpointNs = config.configurable?.['checkpoint_ns'];

    if (threadId === undefined) {
      throw new Error(`Failed to put writes. The passed RunnableConfig is missing a required "thread_id" field in its "configurable" property`);
    }

    if (checkpointId === undefined) {
      throw new Error(`Failed to put writes. The passed RunnableConfig is missing a required "checkpoint_id" field in its "configurable" property.`);
    }

    const writesPath = this.pathResolver.getWritesPath(threadId, checkpointNs, checkpointId);

    await checkOrCreateFolder(writesPath);

    const promises = writes.map(async ([channel, value], idx) => {
      const innerKeys: [string, string, number] = [taskId, channel, WRITES_IDX_MAP[channel] || idx];

      const filePath = join(writesPath, this.pathResolver.joinWithSplitter(...innerKeys));

      // first-write-win
      if (innerKeys[2] >= 0 && (await checkFileExists(filePath))) {
        return;
      }

      const [, serializedValue] = await this.serde.dumpsTyped(value);

      await writeBinary(filePath, serializedValue);
    });

    await Promise.all(promises);
  }

  public async deleteThread(threadId: string) {
    return safeDeleteFile(`${this.pathResolver.getThreadPath(threadId)}`);
  }
}
