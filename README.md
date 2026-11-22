# Glycan Flow Simulator — Forward / Inverse インタラクティブ教材

このリポジトリは、糖鎖生合成をフローネットワークで説明し、**Forward（容量から流量・終端分布を計算）** と **Inverse（目標分布を再現する容量補正を求める）** の考え方を体験する、**独立した静的Webサイト**です。

## すぐ試す

`index.html` をダブルクリックするだけで起動します。サーバーやAPIキーは必要ありません。GitHub Pagesにもそのまま配置できます。

- ネットワークの線をクリックして反応を選択し、容量を初期値の0〜200%で操作します。
- UQ、CWQ、SU、LCRQを切り替え、流量・終端糖鎖の分布の変化を見ます。
- 「4手法を同じ初期容量で比較する」で、すべてのエッジを100%とした共通条件を比較します。
- Inverseの画面で、糖鎖Cの目標割合がなぜ元の容量では実現できないかを確認し、E13を58→66に補正した結果を表示します。

## 科学的な注意

- **ネットワークの容量と目標分布は説明用に作成した架空の値です。** 実験データ、遺伝子発現量、測定した糖鎖分布ではありません。
- Forwardは、最大流量を求めて固定した後、4種類の二次目的関数から1つを選び流量を配分します。目標分布とのズレを最小化する計算ではありません。
- Inverseは、基準容量からの変更を小さくし、目標（A25%、B20%、C55%）を再現する**事前計算済みの検証例**です。現在の手動スライダー設定からその場で最適化しているわけではありません。
- Inverseが与える流量は、補正容量でForwardの4手法を再計算したときの流量と一致するとは限りません。
- 数理検証の経緯と条件は `MATH_VALIDATION_v6.md` を参照してください。これは**v6計算コアの検証資料**で、v7では計算コアを変更せず表示と説明を改良しています。

## 構成

```text
index.html               公開ページ（オフラインでも動作する完成済み1ファイルHTML）
template.html            UI/CSSの編集用テンプレート
app-demo.js              操作と可視化のロジック
glycan-solver.mjs         Forwardの数理計算コア
inverse_fixture.json     事前検証したInverseの補正例
build_offline.py         index.htmlの再生成用
oracle_trust_constr.json Forward数値比較用データ
MATH_VALIDATION_v6.md    数理検証レポート
tests/                   数値・UIテスト
previews/                画面の参考画像
```

## GitHub Pagesで独立公開

**先輩のサイトや既存リポジトリは変更しません。** 新規リポジトリを作成し、このフォルダの**中身**をルートへアップロードしてください。

1. GitHubで新しいリポジトリを作る（例：`Glycan-Flow-Simulator`）。
2. `index.html`、`README.md`、関連ソース・`tests/`などを新規リポジトリのルートにアップロードする。
3. GitHubの `Settings` → `Pages` で `Deploy from a branch`、`main`、`/ (root)`を選び保存する。
4. 公開URLは通常 `https://<ユーザー名>.github.io/<リポジトリ名>/` の形式になります。

公開リポジトリにコードや画像を置く前に、第三者の素材やコードを再利用していないか、必要な許諾・出典表示も確認してください。

## ソース変更・テスト

HTMLは `template.html`、`app-demo.js`、`glycan-solver.mjs`、`inverse_fixture.json` から生成します。

```bash
python build_offline.py
node tests/test.mjs
node tests/test_inverse_fixture.mjs
```

追加の画面検証にはPythonのPlaywrightとChromiumが必要です。

```bash
python -m pip install playwright
python -m playwright install chromium
python tests/test_ui.py
python tests/test_viewport.py
python tests/test_inverse_explanation.py
```

この教材は研究の考え方を紹介するためのものであり、実測データの再現性や生物学的妥当性を保証するものではありません。
