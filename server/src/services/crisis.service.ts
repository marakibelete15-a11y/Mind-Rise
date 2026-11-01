import { CrisisPriority, CrisisSource } from '@mindrise/database';
export async function raiseFlag(input:{userId:string;source:CrisisSource;sourceId:string;priority:CrisisPriority}):Promise<void>{
 // TODO Part A owns persistence and delivery of real crisis flag handling.
 console.info('Crisis flag requested', { userId: input.userId, source: input.source, sourceId: input.sourceId, priority: input.priority });
}
