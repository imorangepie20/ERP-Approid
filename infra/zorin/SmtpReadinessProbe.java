import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.UUID;
import java.util.regex.Pattern;
import javax.net.ssl.SSLHandshakeException;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;

/** Operator probe, NOT the ERP reminder API. Never retries or logs SMTP/auth data. */
public final class SmtpReadinessProbe {
    private static final String HOST = "mail.approid.team";
    private static final String ACCOUNT = "primemaster@approid.team";
    private static final String RECIPIENT = "imapplepie20@gmail.com";
    private static final String SUBJECT = "[ERP-Approid] SMTP delivery test";
    private static final Pattern QUEUE_ID = Pattern.compile("(?i)queued as ([A-Za-z0-9]+)");
    private BufferedReader input;
    private BufferedWriter output;
    private boolean dataStarted;
    private boolean accepted;

    public static void main(String[] args) {
        SmtpReadinessProbe probe = new SmtpReadinessProbe();
        try {
            if (args.length < 1 || !(args[0].equals("auth")
                    || args[0].equals("wrong-host") || args[0].equals("send"))) {
                throw new IllegalArgumentException("MODE_REQUIRED");
            }
            UUID messageId = args[0].equals("send") ? UUID.fromString(args[1]) : null;
            probe.run(args[0], messageId);
        } catch (Exception ex) {
            System.out.printf("status=%s error_class=%s%n",
                    probe.accepted ? "SMTP_ACCEPTED" : probe.dataStarted ? "UNKNOWN" : "FAILED",
                    ex.getClass().getSimpleName());
            System.exit(probe.accepted ? 0 : 1);
        }
    }

    private void run(String mode, UUID messageId) throws Exception {
        String resolved = InetAddress.getByName(HOST).getHostAddress();
        if (!resolved.equals("192.168.219.174")) {
            throw new IOException("UNEXPECTED_ROUTE");
        }
        System.out.println("dns=PASS resolved=" + resolved);
        try (Socket plain = new Socket()) {
            plain.connect(new InetSocketAddress(HOST, 587), 5000);
            plain.setSoTimeout(3000);
            bind(plain);
            expect(220);
            command("EHLO erp.approid.team", 250);
            command("STARTTLS", 220);
            String referenceHost = mode.equals("wrong-host") ? "incorrect-host.invalid" : HOST;
            SSLSocketFactory factory = (SSLSocketFactory) SSLSocketFactory.getDefault();
            try (SSLSocket tls = (SSLSocket) factory.createSocket(plain, referenceHost, 587, true)) {
                tls.setSoTimeout(3000);
                SSLParameters parameters = tls.getSSLParameters();
                parameters.setEndpointIdentificationAlgorithm("HTTPS");
                tls.setSSLParameters(parameters);
                try {
                    tls.startHandshake();
                } catch (SSLHandshakeException ex) {
                    if (mode.equals("wrong-host") && hostnameMismatch(ex)) {
                        System.out.println("wrong_hostname=PASS rejected=true");
                        return;
                    }
                    throw ex;
                }
                if (mode.equals("wrong-host")) {
                    throw new IOException("HOSTNAME_NOT_REJECTED");
                }
                System.out.println("tls=PASS protocol=" + tls.getSession().getProtocol()
                        + " hostname_verified=true");
                bind(tls);
                command("EHLO erp.approid.team", 250);
                authenticate();
                if (mode.equals("send")) {
                    send(messageId);
                }
                // SMTP acceptance is authoritative even if QUIT subsequently fails.
                if (!accepted) {
                    command("QUIT", 221);
                }
            }
        }
    }

    private static boolean hostnameMismatch(Throwable ex) {
        for (Throwable cause = ex; cause != null; cause = cause.getCause()) {
            String detail = cause.getMessage();
            if (detail != null && (detail.contains("No name matching")
                    || detail.contains("No subject alternative DNS name matching"))) {
                return true;
            }
        }
        return false;
    }

    private void bind(Socket socket) throws IOException {
        input = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.US_ASCII));
        output = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.US_ASCII));
    }

    private void authenticate() throws IOException {
        // Passed by the server-side operator via stdin, never CLI args/environment/logs.
        String password = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8)).readLine();
        if (password == null || password.isEmpty() || password.length() > 4096) {
            throw new IOException("CREDENTIAL_REQUIRED");
        }
        command("AUTH LOGIN", 334);
        command(Base64.getEncoder().encodeToString(ACCOUNT.getBytes(StandardCharsets.UTF_8)), 334);
        command(Base64.getEncoder().encodeToString(password.getBytes(StandardCharsets.UTF_8)), 235);
        System.out.println("auth=PASS smtp_code=235 account=" + ACCOUNT);
    }

    private void send(UUID messageId) throws IOException {
        String id = "<" + messageId + "@erp.approid.team>";
        command("MAIL FROM:<" + ACCOUNT + ">", 250);
        command("RCPT TO:<" + RECIPIENT + ">", 250);
        command("DATA", 354);
        dataStarted = true;
        output.write("From: " + ACCOUNT + "\r\nTo: " + RECIPIENT + "\r\n"
                + "Subject: " + SUBJECT + "\r\nMessage-ID: " + id + "\r\n"
                + "Date: " + ZonedDateTime.now().format(DateTimeFormatter.RFC_1123_DATE_TIME) + "\r\n"
                + "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n"
                + "This is an ERP-Approid SMTP connection test.\r\n"
                + "It was submitted from the ERP container using authenticated STARTTLS.\r\n"
                + "This is a test message; no payment or other action is requested.\r\n.\r\n");
        output.flush();
        String reply = expect(250);
        accepted = true;
        var queue = QUEUE_ID.matcher(reply);
        System.out.println("status=SMTP_ACCEPTED smtp_code=250 recipient=" + RECIPIENT
                + " message_id=" + id + " queue_id=" + (queue.find() ? queue.group(1) : "UNAVAILABLE"));
    }

    private void command(String value, int expected) throws IOException {
        output.write(value + "\r\n");
        output.flush();
        expect(expected);
    }

    private String expect(int expected) throws IOException {
        StringBuilder reply = new StringBuilder();
        for (int count = 0; count < 100; count++) {
            String line = input.readLine();
            if (line == null || line.length() < 4 || line.length() > 8192
                    || !line.substring(0, 3).chars().allMatch(Character::isDigit)) {
                throw new IOException("INVALID_SMTP_REPLY");
            }
            int code = Integer.parseInt(line.substring(0, 3));
            if (code != expected) {
                throw new IOException("SMTP_CODE_" + code);
            }
            if (reply.length() + line.length() > 65536) {
                throw new IOException("SMTP_REPLY_TOO_LARGE");
            }
            reply.append(line).append('\n');
            if (line.charAt(3) == ' ') {
                return reply.toString();
            }
            if (line.charAt(3) != '-') {
                throw new IOException("INVALID_SMTP_REPLY");
            }
        }
        throw new IOException("SMTP_REPLY_TOO_MANY_LINES");
    }
}
