import tls from "tls";

export async function analyzeSsl(hostname: string, port = 443): Promise<any> {
  return new Promise((resolve) => {
    try {
      const socket = tls.connect(
        {
          host: hostname,
          port,
          servername: hostname,
          rejectUnauthorized: false,
          timeout: 8000,
        },
        () => {
          const cert = socket.getPeerCertificate(true);
          const protocol = socket.getProtocol();
          const cipher = socket.getCipher();

          if (!cert || Object.keys(cert).length === 0) {
            socket.end();
            resolve({ available: false });
            return;
          }

          const now = new Date();
          const validFrom = new Date(cert.valid_from);
          const validTo = new Date(cert.valid_to);
          const daysRemaining = Math.round((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          const chain: string[] = [];
          let current: any = cert;
          const seen = new Set();
          while (current && current.subject && !seen.has(current.fingerprint)) {
            seen.add(current.fingerprint);
            chain.push(current.subject.CN || current.subject.O || "unknown");
            current = current.issuerCertificate;
            if (current === cert.issuerCertificate && chain.length > 1) break;
          }

          resolve({
            available: true,
            issuer: cert.issuer,
            subject: cert.subject,
            commonName: cert.subject?.CN || null,
            san: (cert.subjectaltname || "").split(",").map((s) => s.trim()).filter(Boolean),
            validFrom: cert.valid_from,
            validTo: cert.valid_to,
            daysRemaining,
            expired: now > validTo,
            selfSigned: cert.issuer?.CN === cert.subject?.CN,
            cipher: cipher?.name || null,
            tlsVersion: protocol,
            fingerprint: cert.fingerprint,
            serialNumber: cert.serialNumber,
            chainLength: chain.length,
            chain,
          });
          socket.end();
        }
      );

      socket.on("error", () => resolve({ available: false, error: true }));
      socket.on("timeout", () => {
        socket.destroy();
        resolve({ available: false, error: true, reason: "timeout" });
      });
    } catch {
      resolve({ available: false, error: true });
    }
  });
}
