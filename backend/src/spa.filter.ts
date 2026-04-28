import { ExceptionFilter, Catch, NotFoundException, ArgumentsHost } from '@nestjs/common';
import { join } from 'path';

@Catch(NotFoundException)
export class SpaFilter implements ExceptionFilter {
  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest();
    const res = ctx.getResponse();

    // Routes API → retourner le 404 JSON normal
    if (req.path.startsWith('/api')) {
      return res.status(404).json(exception.getResponse());
    }

    // Toutes les autres routes → servir index.html (React Router prend le relai)
    const distPath = join(__dirname, '..', 'frontend', 'index.html');
    return res.sendFile(distPath);
  }
}
