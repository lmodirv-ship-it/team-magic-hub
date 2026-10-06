import { Panel } from "@/components/nawat/StudioUI";
import { DEFAULT_FREE_UNTIL, setFreeUntil, useGhn } from "@/lib/nawat/groupe-hn-platform";
import { logSettingChange } from "@/lib/nawat/server-settings";

export function FreePeriodSetting() {
  const s = useGhn();
  return (
    <Panel title="الاستعمال المجاني المفتوح" note="البرنامج ونماذج المجموعة بمفتاح أو بدونه">
      <label className="block text-xs text-muted-foreground">مجاني ومفتوح حتى تاريخ</label>
      <input
        type="date"
        dir="ltr"
        className="control mt-1 w-48"
        value={s.freeUntil}
        onChange={(e) => {
          setFreeUntil(e.target.value || DEFAULT_FREE_UNTIL);
          logSettingChange("ghn.freeUntil", e.target.value);
        }}
      />
      <p className="mt-2 text-xs text-nawat">
        {s.freeOpen ? `متبقٍّ ${s.daysLeft} يومًا — استمتع بالبرمجة وابنِ مشاريعك بلا حدود 💚` : "انتهت الفترة المفتوحة — أدخل مفتاح ghn_ في صفحة المزوّدين."}
      </p>
    </Panel>
  );
}
