import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ProgressEvent } from '../../common/types';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/progress',
})
export class ProjectGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(ProjectGateway.name);

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  emitProgress(projectId: string, message: string, progress: number): void {
    const event: ProgressEvent = {
      projectId,
      step: message,
      message,
      progress,
      timestamp: new Date().toISOString(),
    };
    this.server.emit(`progress:${projectId}`, event);
  }
}
