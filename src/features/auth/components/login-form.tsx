"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Info, LockKeyhole, LogIn, UserRound } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { BrandMark } from "@/shared/components/layout/brand-mark";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/lib/utils";

import { loginSchema, type LoginValues } from "../schemas/login-schema";
import { useAuthStore } from "../store/auth-store";

/**
 * Reception login. Username is a phone (`998XXXXXXXXX`) or a uid; only accounts
 * with `is_reception=true` succeed, and the backend's Uzbek 403 message is
 * shown exactly as it arrives.
 *
 * Two persistence mechanisms cooperate here and are easy to confuse:
 *  • "Meni eslab qolish" controls how long OUR session (tokens) survives — this
 *    is what actually keeps the desk signed in day to day.
 *  • The browser's own password manager fills the fields via `autoComplete`.
 *    That only fills the form; it never touches our token logic.
 */
export function LoginForm() {
  const submitting = useAuthStore((s) => s.submitting);
  const signIn = useAuthStore((s) => s.login);
  const [visible, setVisible] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "", remember: true },
    mode: "onSubmit",
  });

  const remember = useWatch({ control, name: "remember" });

  const onSubmit = handleSubmit(async (values) => {
    const ok = await signIn(values);
    if (!ok) {
      const error = useAuthStore.getState().error;
      toast.error(error?.message ?? "Kirishda xatolik yuz berdi");
    }
  });

  return (
    <div className="bg-background relative flex h-dvh items-center justify-center overflow-y-auto px-5 py-10">
      {/* A quiet brand wash — the whole "modern SaaS login" look for one gradient. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_110%_at_50%_15%,color-mix(in_oklab,var(--primary)_9%,transparent)_0%,transparent_62%)]"
      />

      <div className="relative w-full max-w-[420px]">
        <div className="mb-6 flex flex-col items-center gap-3">
          <BrandMark size={64} radius="rounded-lg" className="shadow-md" />
          <p className="text-title-lg text-center">Doctor Ali &mdash; Qabulxona</p>
        </div>

        <form
          onSubmit={onSubmit}
          noValidate
          className="border-border bg-surface rounded-xl border p-6 shadow-xl"
        >
          <div className="mb-5">
            <h2 className="text-headline-sm">Tizimga kirish</h2>
            <p className="text-caption text-text-secondary mt-1">
              Login sifatida telefon raqami yoki uid
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Login</Label>
              <div className="relative">
                <UserRound
                  className="text-text-tertiary pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  id="username"
                  autoComplete="username"
                  inputMode="text"
                  autoFocus
                  placeholder="998901234567"
                  aria-invalid={Boolean(errors.username)}
                  aria-describedby={errors.username ? "username-error" : undefined}
                  className="tabular h-[50px] pl-11"
                  {...register("username")}
                />
              </div>
              {errors.username && (
                <p id="username-error" role="alert" className="text-caption text-danger">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Parol</Label>
              <div className="relative">
                <LockKeyhole
                  className="text-text-tertiary pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  id="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  className="h-[50px] px-11"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setVisible((v) => !v)}
                  aria-label={visible ? "Yashirish" : "Ko'rsatish"}
                  className={cn(
                    "absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center",
                    "text-text-secondary hover:bg-surface-alt rounded-sm transition-colors",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  )}
                >
                  {visible ? (
                    <EyeOff className="size-[18px]" />
                  ) : (
                    <Eye className="size-[18px]" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" role="alert" className="text-caption text-danger">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <Checkbox
                id="remember"
                checked={remember}
                onCheckedChange={(checked) =>
                  setValue("remember", checked === true, { shouldDirty: true })
                }
              />
              <Label
                htmlFor="remember"
                className="text-text-secondary cursor-pointer font-normal"
              >
                Meni eslab qolish
              </Label>
            </div>

            <Button
              type="submit"
              size="lg"
              className="h-[50px] w-full text-base"
              disabled={submitting}
            >
              {submitting ? (
                <span
                  className="border-primary-foreground/40 border-t-primary-foreground size-[18px] animate-spin rounded-full border-2"
                  aria-hidden
                />
              ) : (
                <LogIn className="size-[18px]" aria-hidden />
              )}
              {submitting ? "Kirilmoqda…" : "Kirish"}
            </Button>
          </div>
        </form>

        <div className="border-border bg-surface mt-4 flex items-start gap-2 rounded-md border px-3.5 py-3">
          <Info className="text-text-tertiary mt-px size-4 shrink-0" aria-hidden />
          <p className="text-caption text-text-tertiary leading-relaxed">
            Faqat qabulxona hisoblari kira oladi. Parolni unutgan bo&rsquo;lsangiz
            administratorga murojaat qiling.
          </p>
        </div>
      </div>
    </div>
  );
}
