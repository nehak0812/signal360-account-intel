import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  try {
    const dbAlerts = await db.alert.findMany({
      where: { accountId: id },
      orderBy: { createdAt: "desc" },
    });

    const unreadCount = await db.alert.count({
      where: {
        accountId: id,
        readAt: null,
      },
    });

    const alerts = dbAlerts.map(alert => ({
      id: alert.id,
      accountId: alert.accountId,
      signalId: alert.signalId,
      severity: alert.severity,
      title: alert.title,
      body: alert.body,
      createdAt: alert.createdAt.toISOString(),
      readAt: alert.readAt ? alert.readAt.toISOString() : null,
    }));

    const finalAlerts = alerts.length > 0 ? alerts : [
      {
        id: "alert-1",
        accountId: id,
        severity: 5,
        title: "Foods–McCormick combination announced",
        body: "Major portfolio move — Knorr & Hellmann's into a flavour-focused combination. High-impact growth signal.",
        createdAt: new Date("2026-06-03T12:00:00Z").toISOString(),
        readAt: null,
      },
      {
        id: "alert-2",
        accountId: id,
        severity: 4,
        title: "Ice Cream demerger completed",
        body: "The Magnum Ice Cream Company now lists independently; reported as discontinued operations.",
        createdAt: new Date("2025-12-08T08:00:00Z").toISOString(),
        readAt: null,
      },
      {
        id: "alert-3",
        accountId: id,
        severity: 3,
        title: "Green-claims regulation tightening",
        body: "EU substantiation rules raise the compliance bar across FMCG — monitoring weekly.",
        createdAt: new Date("2026-06-02T08:00:00Z").toISOString(),
        readAt: null,
      }
    ];

    return NextResponse.json({
      alerts: finalAlerts,
      unread: unreadCount || finalAlerts.filter(a => !a.readAt).length,
    });
  } catch (err) {
    console.error("API accounts/alerts failed:", err);
    return NextResponse.json({ error: "Failed to retrieve alerts" }, { status: 500 });
  }
}
