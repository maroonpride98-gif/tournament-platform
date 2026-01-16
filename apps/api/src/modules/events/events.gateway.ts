import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('EventsGateway');
  private userSockets = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Remove from all rooms
    this.userSockets.forEach((sockets, room) => {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSockets.delete(room);
      }
    });
  }

  @SubscribeMessage('join:tournament')
  handleJoinTournament(
    @ConnectedSocket() client: Socket,
    @MessageBody() tournamentId: string,
  ) {
    const room = `tournament:${tournamentId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined ${room}`);

    if (!this.userSockets.has(room)) {
      this.userSockets.set(room, new Set());
    }
    this.userSockets.get(room)?.add(client.id);

    return { success: true, room };
  }

  @SubscribeMessage('leave:tournament')
  handleLeaveTournament(
    @ConnectedSocket() client: Socket,
    @MessageBody() tournamentId: string,
  ) {
    const room = `tournament:${tournamentId}`;
    client.leave(room);
    this.userSockets.get(room)?.delete(client.id);
    this.logger.log(`Client ${client.id} left ${room}`);

    return { success: true };
  }

  @SubscribeMessage('join:chat')
  handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() chatRoomId: string,
  ) {
    const room = `chat:${chatRoomId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined ${room}`);

    return { success: true, room };
  }

  @SubscribeMessage('leave:chat')
  handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() chatRoomId: string,
  ) {
    const room = `chat:${chatRoomId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left ${room}`);

    return { success: true };
  }

  // Emit tournament events
  emitTournamentUpdate(tournamentId: string, event: string, data: any) {
    if (!this.server) {
      this.logger.warn('WebSocket server not initialized, skipping emit');
      return;
    }
    const room = `tournament:${tournamentId}`;
    this.server.to(room).emit(event, data);
    this.logger.debug(`Emitted ${event} to ${room}`);
  }

  // Emit match updates
  emitMatchUpdate(tournamentId: string, matchId: string, data: any) {
    this.emitTournamentUpdate(tournamentId, 'match:updated', { matchId, ...data });
  }

  // Emit bracket updates
  emitBracketUpdate(tournamentId: string, data: any) {
    this.emitTournamentUpdate(tournamentId, 'bracket:updated', data);
  }

  // Emit participant updates
  emitParticipantUpdate(tournamentId: string, data: any) {
    this.emitTournamentUpdate(tournamentId, 'participant:updated', data);
  }

  // Emit tournament status changes
  emitTournamentStatusChange(tournamentId: string, status: string) {
    this.emitTournamentUpdate(tournamentId, 'tournament:status', { status });
  }

  // Emit chat messages
  emitChatMessage(chatRoomId: string, message: any) {
    if (!this.server) return;
    const room = `chat:${chatRoomId}`;
    this.server.to(room).emit('chat:message', message);
  }

  // Emit notifications to specific user
  emitNotification(userId: string, notification: any) {
    if (!this.server) return;
    const room = `user:${userId}`;
    this.server.to(room).emit('notification', notification);
  }

  @SubscribeMessage('join:user')
  handleJoinUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() userId: string,
  ) {
    const room = `user:${userId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined user room ${room}`);

    return { success: true, room };
  }
}
