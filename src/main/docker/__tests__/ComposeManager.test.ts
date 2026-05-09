import { describe, it, expect, vi } from 'vitest';
import { ComposeManager } from '../ComposeManager';

vi.mock('child_process', () => ({
    spawn: vi.fn(() => ({
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
    })),
}));

describe('ComposeManager.generateComposeTemplate', () => {
    it('generates a web-db template with random password', () => {
        const t1 = ComposeManager.generateComposeTemplate('web-db', 'python');
        const t2 = ComposeManager.generateComposeTemplate('web-db', 'python');

        // Both should be valid YAML with postgres config
        expect(t1).toContain('POSTGRES_PASSWORD');
        expect(t1).toContain('POSTGRES_USER: app_user');
        expect(t1).toContain('DATABASE_URL');

        // Passwords should differ (random)
        const pw1 = t1.match(/POSTGRES_PASSWORD: (\w+)/)?.[1];
        const pw2 = t2.match(/POSTGRES_PASSWORD: (\w+)/)?.[1];
        expect(pw1).toBeDefined();
        expect(pw2).toBeDefined();
        expect(pw1).not.toBe(pw2);
    });

    it('does not contain hardcoded "password" as credential', () => {
        const tmpl = ComposeManager.generateComposeTemplate('web-db', 'node');
        // The literal string "password" should not appear as a value
        expect(tmpl).not.toMatch(/POSTGRES_PASSWORD: password\b/);
        expect(tmpl).not.toContain('postgres://user:password@');
    });

    it('generates a fullstack template with random password', () => {
        const tmpl = ComposeManager.generateComposeTemplate('fullstack', 'javascript');
        expect(tmpl).toContain('frontend');
        expect(tmpl).toContain('backend');
        expect(tmpl).toContain('POSTGRES_PASSWORD');
        expect(tmpl).not.toMatch(/POSTGRES_PASSWORD: password\b/);
    });

    it('uses correct language image for web-db python', () => {
        const tmpl = ComposeManager.generateComposeTemplate('web-db', 'python');
        expect(tmpl).toContain('python:3.11-alpine');
    });
});
